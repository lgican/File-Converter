(function () {
  'use strict';

  // --- TNEF Converter Elements ---
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  const fileListEl = document.getElementById('fileList');
  const fileCount = document.getElementById('fileCount');
  const downloadAll = document.getElementById('downloadAll');
  const resetBtn = document.getElementById('resetBtn');
  const versionLabel = document.getElementById('versionLabel');
  const successEl = document.getElementById('successState');
  const tnefQueueList = document.getElementById('tnefQueueList');
  const tnefQueueCount = document.getElementById('tnefQueueCount');
  const tnefAddMoreBtn = document.getElementById('tnefAddMoreBtn');
  const tnefConvertBtn = document.getElementById('tnefConvertBtn');

  // --- Bank Converter Elements ---
  const bankDropzone = document.getElementById('bankDropzone');
  const bankFileInput = document.getElementById('bankFileInput');
  const bankBrowseBtn = document.getElementById('bankBrowseBtn');
  const bankStatusEl = document.getElementById('bankStatus');
  const bankResultsEl = document.getElementById('bankResults');
  const bankFileListEl = document.getElementById('bankFileList');
  const bankFileCount = document.getElementById('bankFileCount');
  const bankDownloadAll = document.getElementById('bankDownloadAll');
  const bankResetBtn = document.getElementById('bankResetBtn');
  const bankSuccessEl = document.getElementById('bankSuccessState');
  const templateSelect = document.getElementById('templateSelect');
  const bankOutputFormat = document.getElementById('bankOutputFormat');
  const bankQueueList = document.getElementById('bankQueueList');
  const bankQueueCount = document.getElementById('bankQueueCount');
  const bankAddMoreBtn = document.getElementById('bankAddMoreBtn');
  const bankConvertBtn = document.getElementById('bankConvertBtn');

  // --- File Converter Elements ---
  const fileConvertDropzone = document.getElementById('fileConvertDropzone');
  const fileConvertFileInput = document.getElementById('fileConvertFileInput');
  const fileConvertBrowseBtn = document.getElementById('fileConvertBrowseBtn');
  const fileConvertStatusEl = document.getElementById('fileConvertStatus');
  const fileConvertResultsEl = document.getElementById('fileConvertResults');
  const fileConvertFileListEl = document.getElementById('fileConvertFileList');
  const fileConvertFileCount = document.getElementById('fileConvertFileCount');
  const fileConvertDownloadAll = document.getElementById('fileConvertDownloadAll');
  const fileConvertResetBtn = document.getElementById('fileConvertResetBtn');
  const fileConvertSuccessEl = document.getElementById('fileConvertSuccessState');
  const fromFormatSelect = document.getElementById('fromFormatSelect');
  const toFormatSelect = document.getElementById('toFormatSelect');
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');
  const addMoreBtn = document.getElementById('addMoreBtn');
  const convertAllBtn = document.getElementById('convertAllBtn');

  // Store multiple files waiting to be converted
  var pendingFiles = [];

  // --- Mode Switcher ---
  const tnefModeBtn = document.getElementById('tnefModeBtn');
  const bankModeBtn = document.getElementById('bankModeBtn');
  const fileConvertModeBtn = document.getElementById('fileConvertModeBtn');
  const tnefContainer = document.getElementById('tnefContainer');
  const bankContainer = document.getElementById('bankContainer');
  const fileConvertContainer = document.getElementById('fileConvertContainer');

  // Fetch version from server and display in footer
  fetch('api/info')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.version) {
        versionLabel.textContent = 'converter v' + data.version;
      }
    })
    .catch(function () {
      // Silently ignore — footer already says "converter"
    });

  // Load bank file templates
  fetch('api/bank/templates')
    .then(function (r) { return r.json(); })
    .then(function (templates) {
      templateSelect.innerHTML = '';
      // Sort keys so BeanStream_Detail (BMO) comes first
      var keys = Object.keys(templates).sort(function(a, b) {
        if (a === 'BeanStream_Detail') return -1;
        if (b === 'BeanStream_Detail') return 1;
        return a.localeCompare(b);
      });
      keys.forEach(function(key) {
        var option = document.createElement('option');
        option.value = key;
        option.textContent = templates[key] + ' (' + key + ')';
        templateSelect.appendChild(option);
      });
    })
    .catch(function () {
      templateSelect.innerHTML = '<option value="">Error loading templates</option>';
    });

  // Load file converter formats
  fetch('api/fileconvert/formats')
    .then(function (r) { return r.json(); })
    .then(function (formats) {
      populateFormatSelectors(formats);
      renderFormatMenus(formats);
    })
    .catch(function () {
      fromFormatSelect.innerHTML = '<option value="">Error loading formats</option>';
      toFormatSelect.innerHTML = '<option value="">Error loading formats</option>';
      // Fallback: build menus from existing select optgroups
      renderFormatMenus(buildFormatsFromSelects());
    });

  function populateFormatSelectors(formats) {
    fromFormatSelect.innerHTML = '<option value="">Auto-detect format</option>';
    toFormatSelect.innerHTML = '<option value="">Select output format...</option>';

    for (var category in formats) {
      var optgroup = document.createElement('optgroup');
      optgroup.label = category.charAt(0).toUpperCase() + category.slice(1);
      
      formats[category].forEach(function (fmt) {
        var option = document.createElement('option');
        option.value = fmt.Extension;
        option.textContent = fmt.Name + ' (' + fmt.Extension + ')';
        optgroup.appendChild(option);
      });

      fromFormatSelect.appendChild(optgroup.cloneNode(true));
      toFormatSelect.appendChild(optgroup);
    }
  }

  // Render category menus with hover submenus
  function renderFormatMenus(formats) {
    var fromMenuEl = document.getElementById('fromFormatMenu');
    var toMenuEl = document.getElementById('toFormatMenu');
    if (!fromMenuEl || !toMenuEl) return;

    // Order: document, image, video, audio
    var order = ['document', 'image', 'video', 'audio'];

    // Normalize keys to lower-case map; if formats missing, use fallback
    var fmtByCat = {};
    if (formats && typeof formats === 'object') {
      for (var cat in formats) {
        fmtByCat[cat.toLowerCase()] = formats[cat];
      }
    } else {
      fmtByCat = buildFormatsFromSelects();
    }

    buildSingleMenu(fromMenuEl, fromFormatSelect, fmtByCat, order, 'Input');
    buildSingleMenu(toMenuEl, toFormatSelect, fmtByCat, order, 'Output');

    // Hide the native selects but keep them for fallback/accessibility
    fromFormatSelect.classList.add('visually-hidden');
    toFormatSelect.classList.add('visually-hidden');
  }

  // Fallback builder: read optgroups/options from existing selects
  function buildFormatsFromSelects() {
    var map = {};
    [fromFormatSelect, toFormatSelect].forEach(function(selectEl){
      if (!selectEl) return;
      Array.prototype.forEach.call(selectEl.children, function(node){
        if (node.tagName && node.tagName.toLowerCase() === 'optgroup') {
          var cat = (node.label || '').toLowerCase();
          if (!cat) return;
          map[cat] = map[cat] || [];
          Array.prototype.forEach.call(node.children, function(opt){
            if (opt.tagName && opt.tagName.toLowerCase() === 'option' && opt.value) {
              // Avoid duplicates
              var exists = map[cat].some(function(f){ return f.Extension === opt.value; });
              if (!exists) {
                map[cat].push({ Extension: opt.value, Name: opt.textContent.replace(/\s*\(.*\)$/, '') });
              }
            }
          });
        }
      });
    });
    return map;
  }

  function buildSingleMenu(container, selectEl, fmtByCat, order, labelPrefix) {
    container.innerHTML = '';

    var defaultLabel = labelPrefix === 'Input' ? 'Auto-detect' : 'Select...';
    var currentLabel = selectEl.value ? selectEl.value.toUpperCase() : defaultLabel;

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'menu-trigger';
    trigger.innerHTML = labelPrefix + ' Format \u2014 <span class="trigger-value">' + currentLabel + '</span> <span class="arrow">\u25BE</span>';

    function updateTrigger(text) {
      trigger.querySelector('.trigger-value').textContent = text;
    }

    var dropdown = document.createElement('div');
    dropdown.className = 'menu-dropdown';

    // Add Auto-detect option for Input dropdown
    if (labelPrefix === 'Input') {
      var autoItem = document.createElement('div');
      autoItem.className = 'category-item auto-detect-item';
      autoItem.textContent = 'Auto-detect';
      autoItem.addEventListener('click', function(e){
        selectEl.value = '';
        updateTrigger('Auto-detect');
        dropdown.classList.remove('open');
        e.stopPropagation();
      });
      dropdown.appendChild(autoItem);
    }

    // Build categories with expandable sublists
    order.forEach(function(catKey){
      var items = fmtByCat[catKey] || [];
      if (!items.length) return;

      var cat = document.createElement('div');
      cat.className = 'category-item';
      cat.textContent = capitalize(catKey);

      var ul = document.createElement('ul');
      ul.className = 'sublist';
      items.forEach(function(fmt){
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'subitem';
        btn.textContent = fmt.Name;
        var extSpan = document.createElement('span');
        extSpan.className = 'ext';
        extSpan.textContent = fmt.Extension;
        btn.appendChild(extSpan);
        btn.addEventListener('click', function(){
          selectEl.value = fmt.Extension;
          updateTrigger(fmt.Extension.toUpperCase());
          dropdown.classList.remove('open');
        });
        li.appendChild(btn);
        ul.appendChild(li);
      });

      dropdown.appendChild(cat);
      dropdown.appendChild(ul);

      // Toggle sublist on click only
      cat.addEventListener('click', function(e){
        var isOpen = cat.classList.contains('open');
        var allCats = dropdown.querySelectorAll('.category-item');
        var allSubs = dropdown.querySelectorAll('.sublist');
        for (var i = 0; i < allCats.length; i++) {
          allCats[i].classList.remove('open');
        }
        for (var i = 0; i < allSubs.length; i++) {
          allSubs[i].classList.remove('open');
        }
        if (!isOpen) {
          cat.classList.add('open');
          ul.classList.add('open');
        }
        e.stopPropagation();
      });
    });

    // Open/close
    trigger.addEventListener('click', function(e){
      dropdown.classList.toggle('open');
      e.stopPropagation();
    });
    document.addEventListener('click', function(){ dropdown.classList.remove('open'); });

    container.appendChild(trigger);
    container.appendChild(dropdown);

    // Hide native select
    selectEl.classList.add('visually-hidden');
  }

  function capitalize(s){
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // --- Mode Switching ---
  tnefModeBtn.addEventListener('click', function () {
    tnefModeBtn.classList.add('active');
    bankModeBtn.classList.remove('active');
    fileConvertModeBtn.classList.remove('active');
    tnefContainer.classList.remove('hidden');
    bankContainer.classList.add('hidden');
    fileConvertContainer.classList.add('hidden');
  });

  bankModeBtn.addEventListener('click', function () {
    bankModeBtn.classList.add('active');
    tnefModeBtn.classList.remove('active');
    fileConvertModeBtn.classList.remove('active');
    tnefContainer.classList.add('hidden');
    bankContainer.classList.remove('hidden');
    fileConvertContainer.classList.add('hidden');
  });

  fileConvertModeBtn.addEventListener('click', function () {
    fileConvertModeBtn.classList.add('active');
    tnefModeBtn.classList.remove('active');
    bankModeBtn.classList.remove('active');
    tnefContainer.classList.add('hidden');
    bankContainer.classList.add('hidden');
    fileConvertContainer.classList.remove('hidden');
  });

  // --- TNEF Converter Logic ---

  // File staging variable
  var tnefPendingFile = null;

  function stageTnefFile(file) {
    tnefPendingFile = file;
    tnefQueueList.innerHTML = '';
    var queueItem = document.createElement('div');
    queueItem.className = 'queue-item';
    var ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    var iconText = ext === '.dat' ? 'DAT' : 'FILE';
    queueItem.innerHTML =
      '<div class="file-icon">' + escHtml(iconText) + '</div>' +
      '<div class="file-info">' +
        '<span class="file-name">' + escHtml(file.name) + '</span>' +
        '<span class="file-size">' + humanSize(file.size) + '</span>' +
      '</div>' +
      '<button class="remove-file-btn" title="Remove">\u00d7</button>';
    queueItem.querySelector('.remove-file-btn').addEventListener('click', clearTnefStage);
    tnefQueueList.appendChild(queueItem);
    tnefQueueCount.textContent = '1';
    tnefConvertBtn.disabled = false;
    dropzone.classList.add('hidden');
    statusEl.textContent = '';
  }

  function clearTnefStage() {
    tnefPendingFile = null;
    tnefQueueList.innerHTML = '';
    tnefQueueCount.textContent = '0';
    tnefConvertBtn.disabled = true;
    dropzone.classList.remove('hidden');
    fileInput.value = '';
  }

  tnefAddMoreBtn.addEventListener('click', function () {
    fileInput.click();
  });

  tnefConvertBtn.addEventListener('click', function () {
    if (tnefPendingFile) {
      upload(tnefPendingFile);
    }
  });

  // File selection
  browseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', function () {
    fileInput.click();
  });

  // Drag and drop
  ['dragenter', 'dragover'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.add('active');
    });
  });

  ['dragleave', 'drop'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.remove('active');
    });
  });

  dropzone.addEventListener('drop', function (e) {
    if (e.dataTransfer.files.length > 0) {
      stageTnefFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) {
      stageTnefFile(fileInput.files[0]);
    }
  });

  // Reset
  resetBtn.addEventListener('click', function () {
    resultsEl.classList.add('hidden');
    successEl.classList.remove('flex');
    successEl.classList.add('hidden');
    resetBtn.classList.add('hidden');
    statusEl.textContent = '';
    clearTnefStage();
  });

  /**
   * Upload a file to the conversion API.
   * @param {File} file
   */
  function upload(file) {
    statusEl.className = 'status';
    statusEl.innerHTML =
      '<span class="spinner"></span>Converting ' + escHtml(file.name) + '…';
    resultsEl.classList.add('hidden');
    resetBtn.classList.add('hidden');

    var form = new FormData();
    form.append('file', file);

    fetch('api/convert', { method: 'POST', body: form })
      .then(function (resp) {
        return resp.json().then(function (data) {
          return { ok: resp.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          statusEl.className = 'status error';
          statusEl.textContent = result.data.error || 'Conversion failed';
          return;
        }
        statusEl.textContent = '';
        showSuccess(result.data);
      })
      .catch(function () {
        statusEl.className = 'status error';
        statusEl.textContent = 'Connection error';
      });
  }

  /**
   * Show a brief success animation, then render the file list.
   * @param {Object} data - Response from /api/convert
   */
  function showSuccess(data) {
    successEl.classList.remove('hidden');
    successEl.classList.add('flex');
    setTimeout(function () {
      successEl.classList.remove('flex');
      successEl.classList.add('hidden');
      showResults(data);
    }, 700);
  }

  /**
   * Render the extracted file list.
   * @param {Object} data - Response from /api/convert
   */
  function showResults(data) {
    var sid = data.sessionToken;
    var files = data.files;

    fileCount.textContent = files.length;
    downloadAll.href = 'api/zip/' + sid;
    fileListEl.innerHTML = '';

    files.forEach(function (f, i) {
      var li = document.createElement('li');
      li.style.animationDelay = (i * 50) + 'ms';
      var fileUrl = 'api/files/' + sid + '/' + encodeURIComponent(f.name);

      li.innerHTML =
        '<div class="file-icon ' + escAttr(f.type) + '">' +
          escHtml(iconLabel(f.type)) +
        '</div>' +
        '<div class="file-info">' +
          '<span class="file-name" title="' + escAttr(f.name) + '">' +
            escHtml(f.name) +
          '</span>' +
          '<span class="file-size">' + humanSize(f.size) + '</span>' +
        '</div>' +
        '<div class="file-actions">' +
          '<a href="' + fileUrl + '" target="_blank">' +
            '<svg viewBox="0 0 24 24">' +
              '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
              '<circle cx="12" cy="12" r="3"/>' +
            '</svg>' +
            'View' +
          '</a>' +
          '<a href="' + fileUrl + '" download="' + escAttr(f.name) + '">' +
            '<svg viewBox="0 0 24 24">' +
              '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
              '<polyline points="7 10 12 15 17 10"/>' +
              '<line x1="12" y1="15" x2="12" y2="3"/>' +
            '</svg>' +
            'Save' +
          '</a>' +
        '</div>';

      fileListEl.appendChild(li);
    });

    resultsEl.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
  }

  // --- Bank Converter Logic ---

  // File staging variable
  var bankPendingFile = null;

  function stageBankFile(file) {
    bankPendingFile = file;
    bankQueueList.innerHTML = '';
    var queueItem = document.createElement('div');
    queueItem.className = 'queue-item';
    var ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    var iconText = 'FILE';
    if (ext === '.csv') iconText = 'CSV';
    else if (ext === '.xlsx' || ext === '.xls') iconText = 'XLS';
    queueItem.innerHTML =
      '<div class="file-icon">' + escHtml(iconText) + '</div>' +
      '<div class="file-info">' +
        '<span class="file-name">' + escHtml(file.name) + '</span>' +
        '<span class="file-size">' + humanSize(file.size) + '</span>' +
      '</div>' +
      '<button class="remove-file-btn" title="Remove">\u00d7</button>';
    queueItem.querySelector('.remove-file-btn').addEventListener('click', clearBankStage);
    bankQueueList.appendChild(queueItem);
    bankQueueCount.textContent = '1';
    bankConvertBtn.disabled = false;
    bankDropzone.classList.add('hidden');
    bankStatusEl.textContent = '';
  }

  function clearBankStage() {
    bankPendingFile = null;
    bankQueueList.innerHTML = '';
    bankQueueCount.textContent = '0';
    bankConvertBtn.disabled = true;
    bankDropzone.classList.remove('hidden');
    bankFileInput.value = '';
  }

  bankAddMoreBtn.addEventListener('click', function () {
    bankFileInput.click();
  });

  bankConvertBtn.addEventListener('click', function () {
    if (bankPendingFile) {
      uploadBank(bankPendingFile);
    }
  });

  // File selection
  bankBrowseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    bankFileInput.click();
  });

  bankDropzone.addEventListener('click', function () {
    bankFileInput.click();
  });

  // Drag and drop
  ['dragenter', 'dragover'].forEach(function (evt) {
    bankDropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      bankDropzone.classList.add('active');
    });
  });

  ['dragleave', 'drop'].forEach(function (evt) {
    bankDropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      bankDropzone.classList.remove('active');
    });
  });

  bankDropzone.addEventListener('drop', function (e) {
    if (e.dataTransfer.files.length > 0) {
      stageBankFile(e.dataTransfer.files[0]);
    }
  });

  bankFileInput.addEventListener('change', function () {
    if (bankFileInput.files.length > 0) {
      stageBankFile(bankFileInput.files[0]);
    }
  });

  // Reset
  bankResetBtn.addEventListener('click', function () {
    bankResultsEl.classList.add('hidden');
    bankSuccessEl.classList.remove('flex');
    bankSuccessEl.classList.add('hidden');
    bankResetBtn.classList.add('hidden');
    bankStatusEl.textContent = '';
    clearBankStage();
  });

  /**
   * Upload a CSV or Excel file to the bank conversion API.
   * @param {File} file
   */
  function uploadBank(file) {
    var template = templateSelect.value;
    if (!template) {
      bankStatusEl.className = 'status error';
      bankStatusEl.textContent = 'Please select a template first';
      return;
    }

    bankStatusEl.className = 'status';
    bankStatusEl.innerHTML =
      '<span class="spinner"></span>Converting ' + escHtml(file.name) + '…';
    bankResultsEl.classList.add('hidden');
    bankResetBtn.classList.add('hidden');

    var form = new FormData();
    form.append('file', file);
    form.append('template', template);
    form.append('outputFormat', bankOutputFormat.value);

    fetch('api/bank/convert', { method: 'POST', body: form })
      .then(function (resp) {
        return resp.json().then(function (data) {
          return { ok: resp.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          bankStatusEl.className = 'status error';
          bankStatusEl.textContent = result.data.error || 'Conversion failed';
          return;
        }
        bankStatusEl.textContent = '';
        showBankSuccess(result.data);
      })
      .catch(function () {
        bankStatusEl.className = 'status error';
        bankStatusEl.textContent = 'Connection error';
      });
  }

  /**
   * Show a brief success animation, then render the bank file list.
   * @param {Object} data - Response from /api/bank/convert
   */
  function showBankSuccess(data) {
    bankSuccessEl.classList.remove('hidden');
    bankSuccessEl.classList.add('flex');
    setTimeout(function () {
      bankSuccessEl.classList.remove('flex');
      bankSuccessEl.classList.add('hidden');
      showBankResults(data);
    }, 700);
  }

  /**
   * Render the bank converted file list.
   * @param {Object} data - Response from /api/bank/convert
   */
  function showBankResults(data) {
    var sid = data.sessionToken;
    var files = data.files;

    bankFileCount.textContent = files.length;
    bankDownloadAll.href = 'api/zip/' + sid;
    bankFileListEl.innerHTML = '';

    files.forEach(function (f, i) {
      var li = document.createElement('li');
      li.style.animationDelay = (i * 50) + 'ms';
      var fileUrl = 'api/files/' + sid + '/' + encodeURIComponent(f.name);

      li.innerHTML =
        '<div class="file-icon ' + escAttr(f.type) + '">' +
          escHtml(iconLabel(f.type)) +
        '</div>' +
        '<div class="file-info">' +
          '<span class="file-name" title="' + escAttr(f.name) + '">' +
            escHtml(f.name) +
          '</span>' +
          '<span class="file-size">' + humanSize(f.size) + '</span>' +
        '</div>' +
        '<div class="file-actions">' +
          '<a href="' + fileUrl + '" target="_blank">' +
            '<svg viewBox="0 0 24 24">' +
              '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
              '<circle cx="12" cy="12" r="3"/>' +
            '</svg>' +
            'View' +
          '</a>' +
          '<a href="' + fileUrl + '" download="' + escAttr(f.name) + '">' +
            '<svg viewBox="0 0 24 24">' +
              '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
              '<polyline points="7 10 12 15 17 10"/>' +
              '<line x1="12" y1="15" x2="12" y2="3"/>' +
            '</svg>' +
            'Save' +
          '</a>' +
        '</div>';

      bankFileListEl.appendChild(li);
    });

    bankResultsEl.classList.remove('hidden');
    bankResetBtn.classList.remove('hidden');
  }

  // --- Helpers ---

  var typeLabels = {
    html: 'HTML',
    text: 'TXT',
    rtf: 'RTF',
    image: 'IMG',
    pdf: 'PDF',
    document: 'DOC',
    spreadsheet: 'XLS',
    file: 'FILE'
  };

  function iconLabel(type) {
    return typeLabels[type] || 'FILE';
  }

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    var units = ['KB', 'MB', 'GB'];
    var i = -1;
    var size = bytes;
    do {
      size /= 1024;
      i++;
    } while (size >= 1024 && i < units.length - 1);
    return size.toFixed(1) + ' ' + units[i];
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function escAttr(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // --- File Converter Logic ---

  // Check if all required elements exist
  if (!fileConvertDropzone || !fileConvertFileInput || !fileConvertBrowseBtn) {
    console.error('File converter elements not found:', {
      dropzone: !!fileConvertDropzone,
      fileInput: !!fileConvertFileInput,
      browseBtn: !!fileConvertBrowseBtn
    });
  }

  // File selection
  fileConvertBrowseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    fileConvertFileInput.click();
  });

  fileConvertDropzone.addEventListener('click', function () {
    fileConvertFileInput.click();
  });

  // Drag and drop
  ['dragenter', 'dragover'].forEach(function (evt) {
    fileConvertDropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      fileConvertDropzone.classList.add('active');
    });
  });

  ['dragleave', 'drop'].forEach(function (evt) {
    fileConvertDropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      fileConvertDropzone.classList.remove('active');
    });
  });

  fileConvertDropzone.addEventListener('drop', function (e) {
    if (e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  });

  fileConvertFileInput.addEventListener('change', function () {
    if (fileConvertFileInput.files.length > 0) {
      addFilesToQueue(Array.from(fileConvertFileInput.files));
      fileConvertFileInput.value = ''; // Reset for next selection
    }
  });

  // Add more files button
  addMoreBtn.addEventListener('click', function () {
    fileConvertFileInput.click();
  });

  // Convert all button
  convertAllBtn.addEventListener('click', function () {
    if (pendingFiles.length > 0) {
      convertAllFiles();
    }
  });

  // Reset
  fileConvertResetBtn.addEventListener('click', function () {
    fileConvertResultsEl.classList.add('hidden');
    fileConvertSuccessEl.classList.remove('flex');
    fileConvertSuccessEl.classList.add('hidden');
    fileConvertResetBtn.classList.add('hidden');
    fileConvertDropzone.classList.remove('hidden');
    fileConvertStatusEl.textContent = '';
    fileConvertFileInput.value = '';
    pendingFiles = [];
    queueList.innerHTML = '';
    updateQueueUI();
  });

  /**
   * Add files to the conversion queue.
   * @param {File[]} files
   */
  function addFilesToQueue(files) {
    files.forEach(function(file) {
      pendingFiles.push(file);
      
      var queueItem = document.createElement('div');
      queueItem.className = 'queue-item';
      queueItem.dataset.fileName = file.name;
      
      var ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      var iconText = 'FILE';
      if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff'].indexOf(ext) !== -1) {
        iconText = 'IMG';
      } else if (['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'].indexOf(ext) !== -1) {
        iconText = 'AUD';
      } else if (['.mp4', '.webm', '.mkv', '.avi', '.mov'].indexOf(ext) !== -1) {
        iconText = 'VID';
      }
      
      queueItem.innerHTML = 
        '<div class="file-icon">' + escHtml(iconText) + '</div>' +
        '<div class="file-info">' +
          '<span class="file-name">' + escHtml(file.name) + '</span>' +
          '<span class="file-size">' + humanSize(file.size) + '</span>' +
        '</div>' +
        '<button class="remove-file-btn" title="Remove">×</button>';
      
      queueItem.querySelector('.remove-file-btn').addEventListener('click', function() {
        removeFileFromQueue(file.name);
      });
      
      queueList.appendChild(queueItem);
    });
    
    updateQueueUI();
  }

  /**
   * Remove a file from the queue.
   * @param {string} fileName
   */
  function removeFileFromQueue(fileName) {
    pendingFiles = pendingFiles.filter(function(f) { return f.name !== fileName; });
    
    var items = queueList.querySelectorAll('.queue-item');
    for (var i = 0; i < items.length; i++) {
      if (items[i].dataset.fileName === fileName) {
        items[i].remove();
        break;
      }
    }
    
    updateQueueUI();
  }

  /**
   * Update queue UI state.
   */
  function updateQueueUI() {
    queueCount.textContent = pendingFiles.length;
    convertAllBtn.disabled = pendingFiles.length === 0;
    
    if (pendingFiles.length > 0) {
      fileConvertDropzone.classList.add('hidden');
    } else {
      fileConvertDropzone.classList.remove('hidden');
    }
  }

  /**
   * Convert all queued files.
   */
  function convertAllFiles() {
    var toFormat = toFormatSelect.value;
    var fromFormat = fromFormatSelect.value;
        // Require output format to be selected
    if (!toFormat || toFormat === '') {
      fileConvertStatusEl.className = 'status error';
      fileConvertStatusEl.textContent = 'Please select an output format before converting';
      return;
    }
        fileConvertStatusEl.className = 'status';
    fileConvertStatusEl.innerHTML =
      '<span class="spinner"></span>Converting ' + pendingFiles.length + ' file(s)…';
    fileConvertResultsEl.classList.add('hidden');
    fileConvertResetBtn.classList.add('hidden');
    
    var allFiles = [];
    var completed = 0;
    var totalFiles = pendingFiles.length;
    var sessionToken = null;
    var errors = [];
    
    pendingFiles.forEach(function(file) {
      var form = new FormData();
      form.append('file', file);
      if (fromFormat) {
        form.append('from', fromFormat);
      }
      form.append('to', toFormat);
      form.append('quality', 100);

      fetch('api/fileconvert/convert', { method: 'POST', body: form })
        .then(function (resp) {
          return resp.json().then(function (data) {
            return { ok: resp.ok, data: data };
          });
        })
        .then(function (result) {
          completed++;
          
          if (!result.ok) {
            var errMsg = result.data.error || 'Unknown error';
            errors.push({ name: file.name, error: errMsg });
            console.error('Conversion failed for ' + file.name + ':', errMsg);
          } else {
            if (!sessionToken) {
              sessionToken = result.data.sessionToken;
            }
            allFiles = allFiles.concat(result.data.files);
          }
          
          if (completed === totalFiles) {
            fileConvertStatusEl.textContent = '';
            if (allFiles.length > 0 && sessionToken) {
              showFileConvertSuccess({ sessionToken: sessionToken, files: allFiles });
            } else {
              fileConvertStatusEl.className = 'status error';
              fileConvertStatusEl.textContent = friendlyConversionError(errors, fromFormat, toFormat);
            }
          }
        })
        .catch(function (err) {
          completed++;
          errors.push({ name: file.name, error: 'Connection error' });
          console.error('Error converting ' + file.name + ':', err);
          
          if (completed === totalFiles && allFiles.length === 0) {
            fileConvertStatusEl.className = 'status error';
            fileConvertStatusEl.textContent = friendlyConversionError(errors, fromFormat, toFormat);
          }
        });
    });
  }

  /**
   * Build a user-friendly error message for failed conversions.
   */
  function friendlyConversionError(errors, fromFormat, toFormat) {
    if (!errors.length) return 'Conversion failed';
    var err = errors[0].error;
    // Check for unsupported conversion (format mismatch)
    if (err.indexOf('unsupported conversion') !== -1 || err.indexOf('Unsupported') !== -1) {
      var fromExt = (fromFormat || '').toLowerCase().replace(/^\./, '');
      var toExt = (toFormat || '').toLowerCase().replace(/^\./, '');
      // Special case: PDF cannot be used as input
      if (fromExt === 'pdf') {
        return 'PDF files cannot be converted to other formats \u2014 PDF is supported as an output format only';
      }
      var fromCat = formatCategory(fromFormat);
      var toCat = formatCategory(toFormat);
      if (fromCat && toCat && fromCat !== toCat) {
        return 'Cannot convert ' + fromCat + ' to ' + toCat + ' \u2014 please choose a compatible output format';
      }
      return 'Cannot convert ' + (fromFormat || 'this file') + ' to ' + toFormat + ' \u2014 this format combination is not supported';
    }
    if (err.indexOf('Could not detect') !== -1) {
      return 'Could not detect the input format \u2014 please select it manually';
    }
    return err;
  }

  /**
   * Determine the category (image/audio/video/document) of a format extension.
   */
  function formatCategory(ext) {
    if (!ext) return '';
    ext = ext.toLowerCase().replace(/^\./, '');
    var cats = {
      image: ['jpg','jpeg','png','gif','bmp','tiff','tif','webp','svg','ico','heic','heif','avif','raw','cr2','nef','arw','dng','psd','xcf','eps','ai','jxl','jp2','tga','pcx','ppm','pgm','pbm','hdr','exr','dds'],
      audio: ['mp3','wav','flac','aac','ogg','wma','m4a','opus','aiff','alac'],
      video: ['mp4','mkv','avi','mov','wmv','flv','webm','m4v','mpg','mpeg','3gp','ts'],
      document: ['docx','doc','odt','rtf','txt','md','html','epub','pdf','tex','rst','csv','tsv','json','xml','yaml','yml']
    };
    for (var cat in cats) {
      if (cats[cat].indexOf(ext) !== -1) return cat;
    }
    return '';
  }

  /**
   * Upload a file for format conversion (legacy function for compatibility).
   * @param {File} file
   */
  function uploadFileConvert(file) {
    var fromFormat = fromFormatSelect.value;
    var toFormat = toFormatSelect.value;
    var quality = 100; // Always use maximum quality

    // Allow uploading without format selected - will store file for later conversion
    // if (!toFormat || toFormat === '') {
    //   fileConvertStatusEl.className = 'status error';
    //   fileConvertStatusEl.textContent = 'Please select output format';
    //   return;
    // }

    fileConvertStatusEl.className = 'status';
    fileConvertStatusEl.innerHTML =
      '<span class="spinner"></span>Converting ' + escHtml(file.name) + '…';
    fileConvertResultsEl.classList.add('hidden');
    fileConvertResetBtn.classList.add('hidden');

    var form = new FormData();
    form.append('file', file);
    if (fromFormat) {
      form.append('from', fromFormat);
    }
    form.append('to', toFormat);
    form.append('quality', quality);

    fetch('api/fileconvert/convert', { method: 'POST', body: form })
      .then(function (resp) {
        return resp.json().then(function (data) {
          return { ok: resp.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          fileConvertStatusEl.className = 'status error';
          fileConvertStatusEl.textContent = result.data.error || 'Conversion failed';
          return;
        }
        fileConvertStatusEl.textContent = '';
        fileConvertDropzone.classList.add('hidden');
        showFileConvertSuccess(result.data);
      })
      .catch(function () {
        fileConvertStatusEl.className = 'status error';
        fileConvertStatusEl.textContent = 'Connection error';
      });
  }

  /**
   * Show a brief success animation, then render the file converter results.
   * @param {Object} data - Response from /api/fileconvert/convert
   */
  function showFileConvertSuccess(data) {
    fileConvertDropzone.classList.add('hidden');
    fileConvertSuccessEl.classList.remove('hidden');
    fileConvertSuccessEl.classList.add('flex');
    setTimeout(function () {
      fileConvertSuccessEl.classList.remove('flex');
      fileConvertSuccessEl.classList.add('hidden');
      showFileConvertResults(data);
    }, 700);
  }

  /**
   * Render the file converter results.
   * @param {Object} data - Response from /api/fileconvert/convert
   */
  function showFileConvertResults(data) {
    var sid = data.sessionToken;
    var files = data.files;

    fileConvertFileCount.textContent = files.length;
    fileConvertDownloadAll.href = 'api/zip/' + sid;
    fileConvertFileListEl.innerHTML = '';

    files.forEach(function (f, i) {
      var li = document.createElement('li');
      li.style.animationDelay = (i * 50) + 'ms';
      var fileUrl = 'api/files/' + sid + '/' + encodeURIComponent(f.name);

      li.innerHTML =
        '<div class="file-icon ' + escAttr(f.type) + '">' +
          escHtml(iconLabel(f.type)) +
        '</div>' +
        '<div class="file-info">' +
          '<span class="file-name" title="' + escAttr(f.name) + '">' +
            escHtml(f.name) +
          '</span>' +
          '<span class="file-size">' + humanSize(f.size) + '</span>' +
        '</div>' +
        '<div class="file-actions">' +
          '<a href="' + fileUrl + '" target="_blank">' +
            '<svg viewBox="0 0 24 24">' +
              '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
              '<circle cx="12" cy="12" r="3"/>' +
            '</svg>' +
            'View' +
          '</a>' +
          '<a href="' + fileUrl + '" download="' + escAttr(f.name) + '">' +
            '<svg viewBox="0 0 24 24">' +
              '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
              '<polyline points="7 10 12 15 17 10"/>' +
              '<line x1="12" y1="15" x2="12" y2="3"/>' +
            '</svg>' +
            'Save' +
          '</a>' +
        '</div>';

      fileConvertFileListEl.appendChild(li);
    });

    fileConvertResultsEl.classList.remove('hidden');
    fileConvertResetBtn.classList.remove('hidden');
  }
})();
