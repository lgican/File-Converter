// Package fileconvert handles PDF text extraction using pdftotext or a Go-based fallback.
package fileconvert

import (
	"bytes"
	"compress/zlib"
	"fmt"
	"io"
	"os/exec"
	"regexp"
	"strings"
	"unicode"
)

type pdfConverter struct{}

func init() {
	Register(&pdfConverter{})
}

func (c *pdfConverter) Name() string {
	return "PDF Text Extractor"
}

func (c *pdfConverter) SupportedFormats() []Format {
	// Don't re-declare formats already in document converter — just declare what
	// *this* converter uniquely handles (PDF as input to text formats).
	return []Format{}
}

func (c *pdfConverter) CanConvert(from, to string) bool {
	from = normalizeExt(from)
	to = normalizeExt(to)

	if from != ".pdf" {
		return false
	}

	// We can extract PDF text to these formats
	switch to {
	case ".txt", ".md", ".html":
		return true
	}
	return false
}

func (c *pdfConverter) Convert(req ConversionRequest) (*ConversionResult, error) {
	to := normalizeExt(req.ToFormat)

	// Try pdftotext first (if available via system PATH or bundled)
	if text, err := extractWithPdftotext(req.Data); err == nil && len(strings.TrimSpace(string(text))) > 0 {
		output := formatPdfText(text, to)
		return &ConversionResult{
			Data:     output,
			MimeType: getDocumentMimeType(to),
		}, nil
	}

	// Fallback: extract text streams from PDF manually
	text, err := extractPdfTextStreams(req.Data)
	if err != nil || len(strings.TrimSpace(string(text))) == 0 {
		return nil, fmt.Errorf("could not extract text from PDF — the PDF may contain only scanned images")
	}

	output := formatPdfText(text, to)
	return &ConversionResult{
		Data:     output,
		MimeType: getDocumentMimeType(to),
	}, nil
}

// extractWithPdftotext tries to use the pdftotext command (from poppler or xpdf).
func extractWithPdftotext(data []byte) ([]byte, error) {
	path, found := findBinary("pdftotext")
	if !found {
		return nil, fmt.Errorf("pdftotext not found")
	}

	cmd := exec.Command(path, "-", "-") // stdin → stdout
	cmd.Stdin = bytes.NewReader(data)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("pdftotext failed: %w (%s)", err, stderr.String())
	}
	return stdout.Bytes(), nil
}

// extractPdfTextStreams does a basic extraction of text from PDF content streams.
// This handles most text-based PDFs (not scanned/image PDFs).
func extractPdfTextStreams(data []byte) ([]byte, error) {
	var allText strings.Builder

	// Find all stream...endstream blocks
	streamStart := regexp.MustCompile(`stream\r?\n`)
	streamEnd := []byte("\nendstream")

	positions := streamStart.FindAllIndex(data, -1)
	for _, pos := range positions {
		start := pos[1] // after "stream\n"
		endIdx := bytes.Index(data[start:], streamEnd)
		if endIdx == -1 {
			continue
		}
		streamData := data[start : start+endIdx]

		// Try to decompress (most PDF streams are FlateDecode/zlib)
		var textData []byte
		r, err := zlib.NewReader(bytes.NewReader(streamData))
		if err == nil {
			decompressed, err := io.ReadAll(r)
			r.Close()
			if err == nil {
				textData = decompressed
			}
		}
		if textData == nil {
			// Try uncompressed
			textData = streamData
		}

		// Extract text from PDF text operators
		extracted := extractTextOperators(textData)
		if extracted != "" {
			allText.WriteString(extracted)
		}
	}

	result := allText.String()
	if result == "" {
		return nil, fmt.Errorf("no text found in PDF")
	}
	return []byte(result), nil
}

// extractTextOperators parses PDF content stream text operators.
// Handles Tj, TJ, ', " operators.
func extractTextOperators(data []byte) string {
	var result strings.Builder
	content := string(data)

	// Match text showing operators: (text)Tj, [(text)]TJ, BT...ET blocks
	// Simple Tj: (Hello World)Tj
	tjRe := regexp.MustCompile(`\(([^)]*)\)\s*Tj`)
	for _, match := range tjRe.FindAllStringSubmatch(content, -1) {
		result.WriteString(decodePdfString(match[1]))
	}

	// TJ array: [(H)3(ello )(W)4(orld)]TJ
	tjArrayRe := regexp.MustCompile(`\[((?:\([^)]*\)|[^]]*)*)\]\s*TJ`)
	for _, match := range tjArrayRe.FindAllStringSubmatch(content, -1) {
		innerRe := regexp.MustCompile(`\(([^)]*)\)`)
		for _, inner := range innerRe.FindAllStringSubmatch(match[1], -1) {
			result.WriteString(decodePdfString(inner[1]))
		}
	}

	// Single-quote operator: (text)'
	quoteRe := regexp.MustCompile(`\(([^)]*)\)\s*'`)
	for _, match := range quoteRe.FindAllStringSubmatch(content, -1) {
		result.WriteString(decodePdfString(match[1]))
		result.WriteString("\n")
	}

	// Check for Td/TD (text position) operators to insert line breaks
	// When there's a large negative Y offset, it's likely a new line
	tdRe := regexp.MustCompile(`[\d.-]+\s+([\d.-]+)\s+Td`)
	for _, match := range tdRe.FindAllStringSubmatch(content, -1) {
		if strings.HasPrefix(match[1], "-") {
			result.WriteString("\n")
		}
	}

	return result.String()
}

// decodePdfString handles basic PDF string escapes.
func decodePdfString(s string) string {
	s = strings.ReplaceAll(s, "\\n", "\n")
	s = strings.ReplaceAll(s, "\\r", "\r")
	s = strings.ReplaceAll(s, "\\t", "\t")
	s = strings.ReplaceAll(s, "\\(", "(")
	s = strings.ReplaceAll(s, "\\)", ")")
	s = strings.ReplaceAll(s, "\\\\", "\\")

	// Filter out non-printable characters (except whitespace)
	var clean strings.Builder
	for _, r := range s {
		if unicode.IsPrint(r) || unicode.IsSpace(r) {
			clean.WriteRune(r)
		}
	}
	return clean.String()
}

// formatPdfText wraps extracted text into the requested output format.
func formatPdfText(text []byte, toExt string) []byte {
	s := string(text)
	switch toExt {
	case ".html":
		escaped := strings.ReplaceAll(s, "&", "&amp;")
		escaped = strings.ReplaceAll(escaped, "<", "&lt;")
		escaped = strings.ReplaceAll(escaped, ">", "&gt;")
		paragraphs := strings.Split(escaped, "\n\n")
		var buf strings.Builder
		buf.WriteString("<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><title>Extracted PDF Text</title></head>\n<body>\n")
		for _, p := range paragraphs {
			p = strings.TrimSpace(p)
			if p != "" {
				buf.WriteString("<p>" + strings.ReplaceAll(p, "\n", "<br>\n") + "</p>\n")
			}
		}
		buf.WriteString("</body></html>\n")
		return []byte(buf.String())
	case ".md":
		return text // plain text is valid markdown
	default:
		return text
	}
}
