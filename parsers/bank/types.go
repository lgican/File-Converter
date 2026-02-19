// Package bank implements a CSV to fixed-width bank file format parser.
package bank

// Template defines the structure for converting CSV to fixed-width format.
type Template struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Fields      []Field `json:"fields"`
}

// Field defines a single field in the fixed-width format.
type Field struct {
	Name        string `json:"name"`
	Position    int    `json:"position"`
	Length      int    `json:"length"`
	Type        string `json:"type"`        // "text", "numeric", "date"
	Padding     string `json:"padding"`     // Character to pad with
	Align       string `json:"align"`       // "left" or "right"
	Description string `json:"description"` // Optional field description
}

// BankFile represents a parsed bank file with its template and records.
type BankFile struct {
	Template Template
	Records  []Record
}

// Record represents a single row of data mapped from CSV.
type Record map[string]string
