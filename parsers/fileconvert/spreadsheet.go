// Package fileconvert handles spreadsheet conversions using excelize (pure Go).
package fileconvert

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
)

type spreadsheetConverter struct{}

func init() {
	Register(&spreadsheetConverter{})
}

func (c *spreadsheetConverter) Name() string {
	return "Spreadsheet Converter"
}

func (c *spreadsheetConverter) SupportedFormats() []Format {
	// These are declared in document.go already; return empty to avoid
	// duplicate entries in the UI. The registry's CanConvert still routes
	// matching conversions here.
	return []Format{}
}

func (c *spreadsheetConverter) CanConvert(from, to string) bool {
	from = normalizeExt(from)
	to = normalizeExt(to)

	if from == to {
		return false
	}

	// XLSX → CSV
	if from == ".xlsx" && to == ".csv" {
		return true
	}
	// CSV → XLSX
	if from == ".csv" && to == ".xlsx" {
		return true
	}

	return false
}

func (c *spreadsheetConverter) Convert(req ConversionRequest) (*ConversionResult, error) {
	from := normalizeExt(req.FromFormat)
	to := normalizeExt(req.ToFormat)

	switch {
	case from == ".xlsx" && to == ".csv":
		return xlsxToCSV(req.Data)
	case from == ".csv" && to == ".xlsx":
		return csvToXLSX(req.Data)
	default:
		return nil, fmt.Errorf("unsupported spreadsheet conversion: %s → %s", from, to)
	}
}

// xlsxToCSV converts an Excel workbook (first sheet) to CSV.
func xlsxToCSV(data []byte) (*ConversionResult, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to open xlsx: %w", err)
	}
	defer f.Close()

	// Use the first sheet
	sheetName := f.GetSheetName(0)
	if sheetName == "" {
		return nil, fmt.Errorf("xlsx has no sheets")
	}

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to read xlsx rows: %w", err)
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	// Normalise row lengths so every row has the same number of columns
	maxCols := 0
	for _, row := range rows {
		if len(row) > maxCols {
			maxCols = len(row)
		}
	}
	for _, row := range rows {
		padded := make([]string, maxCols)
		copy(padded, row)
		if err := w.Write(padded); err != nil {
			return nil, fmt.Errorf("csv write error: %w", err)
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, fmt.Errorf("csv flush error: %w", err)
	}

	return &ConversionResult{
		Data:     buf.Bytes(),
		MimeType: "text/csv",
	}, nil
}

// csvToXLSX converts CSV data into an Excel workbook.
func csvToXLSX(data []byte) (*ConversionResult, error) {
	r := csv.NewReader(bytes.NewReader(data))
	r.LazyQuotes = true
	r.FieldsPerRecord = -1 // Allow variable column counts

	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse csv: %w", err)
	}

	f := excelize.NewFile()
	defer f.Close()

	sheet := "Sheet1"

	for rowIdx, row := range records {
		for colIdx, cell := range row {
			cellName, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+1)
			// Try to preserve numbers; fall back to string
			cell = strings.TrimSpace(cell)
			f.SetCellValue(sheet, cellName, cell)
		}
	}

	// Auto-width first row columns
	if len(records) > 0 {
		for i := range records[0] {
			colName, _ := excelize.ColumnNumberToName(i + 1)
			f.SetColWidth(sheet, colName, colName, 15)
		}
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("failed to write xlsx: %w", err)
	}

	return &ConversionResult{
		Data:     buf.Bytes(),
		MimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	}, nil
}
