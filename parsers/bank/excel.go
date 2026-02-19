package bank

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
)

// Note: formatValue and getFieldValue are defined in decoder.go

// DecodeExcel parses an Excel file (.xlsx) and returns a BankFile.
func DecodeExcel(data []byte, templateKey string) (*BankFile, error) {
	tpl := GetTemplate(templateKey)
	if tpl == nil {
		return nil, fmt.Errorf("template not found: %s", templateKey)
	}
	return DecodeExcelWithTemplate(data, *tpl)
}

// DecodeExcelWithTemplate parses Excel data using a specific template.
func DecodeExcelWithTemplate(data []byte, template Template) (*BankFile, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	// Get the first sheet
	sheetName := f.GetSheetName(0)
	if sheetName == "" {
		return nil, fmt.Errorf("no sheets found in Excel file")
	}

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to read Excel rows: %w", err)
	}

	if len(rows) < 2 {
		return nil, fmt.Errorf("excel file must have a header row and at least one data row")
	}

	// First row is header
	header := rows[0]
	for i := range header {
		header[i] = strings.TrimSpace(header[i])
	}

	// Remaining rows are data
	var records []Record
	for _, row := range rows[1:] {
		record := make(Record)
		for i, value := range row {
			if i < len(header) {
				record[header[i]] = strings.TrimSpace(value)
			}
		}
		records = append(records, record)
	}

	return &BankFile{
		Template: template,
		Records:  records,
	}, nil
}

// DecodeAuto detects the file type (CSV or Excel) and parses accordingly.
func DecodeAuto(data []byte, templateKey string) (*BankFile, error) {
	if isExcelFile(data) {
		return DecodeExcel(data, templateKey)
	}
	return Decode(data, templateKey)
}

// isExcelFile checks magic bytes for xlsx (ZIP/PK header) or xls (OLE2).
func isExcelFile(data []byte) bool {
	if len(data) < 4 {
		return false
	}
	// XLSX is a ZIP file (PK\x03\x04)
	if data[0] == 0x50 && data[1] == 0x4B && data[2] == 0x03 && data[3] == 0x04 {
		return true
	}
	// XLS is OLE2 Compound Document (\xD0\xCF\x11\xE0)
	if data[0] == 0xD0 && data[1] == 0xCF && data[2] == 0x11 && data[3] == 0xE0 {
		return true
	}
	return false
}

// FormatAsCSV converts the BankFile records back to CSV format.
func (bf *BankFile) FormatAsCSV() ([]byte, error) {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	// Write header row from template fields
	var header []string
	for _, field := range bf.Template.Fields {
		header = append(header, field.Name)
	}
	if err := w.Write(header); err != nil {
		return nil, fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Write data rows (apply the same formatting rules as fixed-width output)
	for _, record := range bf.Records {
		var row []string
		for _, field := range bf.Template.Fields {
			raw := getFieldValue(record, field.Name)
			formatted := strings.TrimSpace(formatValue(raw, field))
			row = append(row, formatted)
		}
		if err := w.Write(row); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	w.Flush()
	return buf.Bytes(), w.Error()
}

// FormatAsExcel converts the BankFile records to an Excel (.xlsx) file.
func (bf *BankFile) FormatAsExcel() ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Sheet1"

	// Write header row
	for i, field := range bf.Template.Fields {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, field.Name)
	}

	// Style the header row (bold)
	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
	})
	for i := range bf.Template.Fields {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellStyle(sheetName, cell, cell, style)
	}

	// Write data rows (apply the same formatting rules as fixed-width output)
	for rowIdx, record := range bf.Records {
		for colIdx, field := range bf.Template.Fields {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			raw := getFieldValue(record, field.Name)
			formatted := strings.TrimSpace(formatValue(raw, field))
			f.SetCellValue(sheetName, cell, formatted)
		}
	}

	// Auto-fit column widths (approximate)
	for i, field := range bf.Template.Fields {
		colName, _ := excelize.ColumnNumberToName(i + 1)
		width := float64(len(field.Name) + 4)
		if width < 12 {
			width = 12
		}
		f.SetColWidth(sheetName, colName, colName, width)
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("failed to write Excel file: %w", err)
	}
	return buf.Bytes(), nil
}

// FormatAsFixedWidth converts to fixed-width formatted output (same as Format()).
func (bf *BankFile) FormatAsFixedWidth() []byte {
	return bf.Format()
}
