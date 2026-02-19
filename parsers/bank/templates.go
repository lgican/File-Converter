package bank

import (
	"encoding/json"
)

// DefaultTemplates contains built-in bank file format templates.
var DefaultTemplates = map[string]Template{
	"BeanStream_Detail": {
		Name:        "BMO File Formatter",
		Description: "Detail record for BeanStream payment file format - character position based",
		Fields: []Field{
			{Name: "Record_Type", Position: 0, Length: 1, Type: "text", Padding: " ", Align: "left", Description: "Record type identifier (E=Detail)"},
			{Name: "Transaction_Type", Position: 1, Length: 1, Type: "text", Padding: " ", Align: "left", Description: "Transaction type (D=Debit, C=Credit)"},
			{Name: "Amount_1", Position: 2, Length: 10, Type: "numeric", Padding: "0", Align: "right", Description: "Transaction amount field 1 (dollars)"},
			{Name: "Amount_2", Position: 12, Length: 10, Type: "numeric", Padding: "0", Align: "right", Description: "Transaction amount field 2 (cents)"},
			{Name: "Reference_Number", Position: 22, Length: 15, Type: "numeric", Padding: "0", Align: "right", Description: "Transaction reference/tracking number"},
			{Name: "Code", Position: 37, Length: 4, Type: "text", Padding: "0", Align: "right", Description: "Bank/branch code"},
			{Name: "Status", Position: 41, Length: 1, Type: "numeric", Padding: "0", Align: "left", Description: "Transaction status"},
			{Name: "Customer_Name", Position: 42, Length: 30, Type: "text", Padding: " ", Align: "left", Description: "Customer/payee name"},
		},
	},
	"ACH_Payment": {
		Name:        "ACH Payment File",
		Description: "Standard ACH payment format",
		Fields: []Field{
			{Name: "Record_Type", Position: 0, Length: 1, Type: "text", Padding: " ", Align: "left"},
			{Name: "Routing_Number", Position: 1, Length: 9, Type: "text", Padding: "0", Align: "left"},
			{Name: "Account_Number", Position: 10, Length: 17, Type: "text", Padding: " ", Align: "left"},
			{Name: "Amount", Position: 27, Length: 10, Type: "numeric", Padding: "0", Align: "right"},
			{Name: "Name", Position: 37, Length: 22, Type: "text", Padding: " ", Align: "left"},
			{Name: "Transaction_Code", Position: 59, Length: 2, Type: "text", Padding: "0", Align: "left"},
			{Name: "ID_Number", Position: 61, Length: 15, Type: "text", Padding: " ", Align: "left"},
		},
	},
	"Wire_Transfer": {
		Name:        "Wire Transfer File",
		Description: "Standard wire transfer format",
		Fields: []Field{
			{Name: "Transaction_Type", Position: 0, Length: 3, Type: "text", Padding: " ", Align: "left"},
			{Name: "Bank_Code", Position: 3, Length: 11, Type: "text", Padding: " ", Align: "left"},
			{Name: "Account", Position: 14, Length: 20, Type: "text", Padding: " ", Align: "left"},
			{Name: "Amount", Position: 34, Length: 15, Type: "numeric", Padding: "0", Align: "right"},
			{Name: "Beneficiary_Name", Position: 49, Length: 35, Type: "text", Padding: " ", Align: "left"},
			{Name: "Reference", Position: 84, Length: 16, Type: "text", Padding: " ", Align: "left"},
		},
	},
	"Direct_Deposit": {
		Name:        "Direct Deposit File",
		Description: "Payroll direct deposit format",
		Fields: []Field{
			{Name: "Employee_ID", Position: 0, Length: 10, Type: "text", Padding: "0", Align: "right"},
			{Name: "First_Name", Position: 10, Length: 15, Type: "text", Padding: " ", Align: "left"},
			{Name: "Last_Name", Position: 25, Length: 20, Type: "text", Padding: " ", Align: "left"},
			{Name: "Bank_Routing", Position: 45, Length: 9, Type: "text", Padding: "0", Align: "left"},
			{Name: "Account_Number", Position: 54, Length: 17, Type: "text", Padding: " ", Align: "left"},
			{Name: "Amount", Position: 71, Length: 12, Type: "numeric", Padding: "0", Align: "right"},
			{Name: "Pay_Date", Position: 83, Length: 8, Type: "date", Padding: "0", Align: "left"},
		},
	},
}

// GetTemplate retrieves a template by key, or returns nil if not found.
func GetTemplate(key string) *Template {
	if tpl, ok := DefaultTemplates[key]; ok {
		return &tpl
	}
	return nil
}

// GetTemplateList returns a list of all available template keys and names.
func GetTemplateList() map[string]string {
	list := make(map[string]string)
	for key, tpl := range DefaultTemplates {
		list[key] = tpl.Name
	}
	return list
}

// LoadCustomTemplate parses a JSON template definition.
func LoadCustomTemplate(jsonData []byte) (*Template, error) {
	var tpl Template
	if err := json.Unmarshal(jsonData, &tpl); err != nil {
		return nil, err
	}
	return &tpl, nil
}
