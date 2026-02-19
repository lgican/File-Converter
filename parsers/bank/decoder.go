// decoder.go implements CSV parsing and fixed-width formatting for bank files.

package bank

import (
	"encoding/csv"
	"fmt"
	"io"
	"strings"
)

// Decode parses CSV data and returns a BankFile with the default template.
func Decode(data []byte, templateKey string) (*BankFile, error) {
	tpl := GetTemplate(templateKey)
	if tpl == nil {
		return nil, fmt.Errorf("template not found: %s", templateKey)
	}
	return DecodeWithTemplate(data, *tpl)
}

// DecodeWithTemplate parses CSV data using a specific template.
func DecodeWithTemplate(data []byte, template Template) (*BankFile, error) {
	reader := csv.NewReader(strings.NewReader(string(data)))
	reader.TrimLeadingSpace = true

	// Read header
	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV header: %w", err)
	}

	// Normalize header names
	for i := range header {
		header[i] = strings.TrimSpace(header[i])
	}

	// Read all records
	var records []Record
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read CSV row: %w", err)
		}

		// Map row to record
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

// Format converts the BankFile to fixed-width formatted output.
func (bf *BankFile) Format() []byte {
	var lines []string
	for _, record := range bf.Records {
		line := formatRecord(record, bf.Template)
		lines = append(lines, line)
	}
	return []byte(strings.Join(lines, "\n"))
}

// formatRecord formats a single record according to the template.
func formatRecord(record Record, template Template) string {
	// Calculate total line length
	maxPosition := 0
	for _, field := range template.Fields {
		endPos := field.Position + field.Length
		if endPos > maxPosition {
			maxPosition = endPos
		}
	}

	// Initialize line with spaces
	line := make([]byte, maxPosition)
	for i := range line {
		line[i] = ' '
	}

	// Format each field
	for _, field := range template.Fields {
		value := getFieldValue(record, field.Name)
		formatted := formatValue(value, field)

		// Place formatted value in line
		for i := 0; i < len(formatted) && i < field.Length; i++ {
			if field.Position+i < maxPosition {
				line[field.Position+i] = formatted[i]
			}
		}
	}

	return string(line)
}

// getFieldValue retrieves a field value from the record (case-insensitive).
func getFieldValue(record Record, fieldName string) string {
	// Try exact match first
	if val, ok := record[fieldName]; ok {
		return val
	}

	// Try case-insensitive match
	lowerFieldName := strings.ToLower(strings.ReplaceAll(fieldName, "_", " "))
	for key, val := range record {
		lowerKey := strings.ToLower(strings.ReplaceAll(key, "_", " "))
		if lowerKey == lowerFieldName {
			return val
		}
	}

	return ""
}

// formatValue formats a value according to field specifications.
func formatValue(value string, field Field) string {
	// Process based on type
	switch field.Type {
	case "numeric":
		// Remove currency symbols, commas, and decimal points
		value = strings.ReplaceAll(value, "$", "")
		value = strings.ReplaceAll(value, ",", "")
		value = strings.ReplaceAll(value, ".", "")
		value = strings.TrimSpace(value)
		if value == "" {
			value = "0"
		}

	case "date":
		// Format date as YYYYMMDD (remove separators)
		value = strings.ReplaceAll(value, "-", "")
		value = strings.ReplaceAll(value, "/", "")
		if len(value) > 8 {
			value = value[:8]
		}
	}

	// Truncate if too long
	if len(value) > field.Length {
		value = value[:field.Length]
	}

	// Pad according to alignment
	padding := field.Padding
	if padding == "" {
		padding = " "
	}

	if field.Align == "right" {
		value = padLeft(value, field.Length, padding[0])
	} else {
		value = padRight(value, field.Length, padding[0])
	}

	return value
}

// padLeft pads a string on the left to reach the specified length.
func padLeft(s string, length int, pad byte) string {
	if len(s) >= length {
		return s
	}
	padding := make([]byte, length-len(s))
	for i := range padding {
		padding[i] = pad
	}
	return string(padding) + s
}

// padRight pads a string on the right to reach the specified length.
func padRight(s string, length int, pad byte) string {
	if len(s) >= length {
		return s
	}
	padding := make([]byte, length-len(s))
	for i := range padding {
		padding[i] = pad
	}
	return s + string(padding)
}
