package statementimport

import (
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"strings"
	"testing"
)

func mapping() domain.StatementMapping {
	return domain.StatementMapping{Date: 0, Description: 1, Amount: 2, Currency: -1, Header: true, Decimal: ",", DateFormat: "DMY"}
}
func TestCSVValidationAndStableIdentity(t *testing.T) {
	content := "Data;Descrição;Valor\n21/10/2026;Mercado;-1.234,56\n22/10/2026;Salário;+2.000,00\n31/02/2026;Data ruim;-1,00\n21/10/2026;Sinal ruim;--1,00\n21/10/2026;Zero;0,00\n"
	b, err := Parse("a", "test.csv", content, "csv", mapping())
	if err != nil {
		t.Fatal(err)
	}
	if len(b.Rows) != 5 || b.Rows[0].Cents != -123456 || b.Rows[1].Cents != 200000 {
		t.Fatalf("linhas: %+v", b.Rows)
	}
	for _, row := range b.Rows[2:] {
		if row.Error == "" {
			t.Fatal("linha inválida aceita")
		}
	}
	again, _ := Parse("a", "test.csv", content, "csv", mapping())
	if again.Hash != b.Hash || again.Rows[0].Fingerprint != b.Rows[0].Fingerprint {
		t.Fatal("identidade instável")
	}
	partial, _ := Parse("a", "partial.csv", "Data;Descrição;Valor\n21/10/2026;Mercado;-1.234,56\n23/10/2026;Novo;-5,00", "csv", mapping())
	if partial.Rows[0].Fingerprint != b.Rows[0].Fingerprint {
		t.Fatal("duplicidade parcial perdida")
	}
}
func TestCSVSeparatorsCurrencyAndInvalidFiles(t *testing.T) {
	for _, separator := range []string{";", "\t", ","} {
		m := mapping()
		m.Decimal = "."
		m.DateFormat = "YMD"
		m.Currency = 3
		b, err := Parse("a", "test.csv", strings.ReplaceAll("date|desc|value|currency\n2026-10-21|Loja|-12.30|BRL\n2026-10-21|Outra|-1.00|USD", "|", separator), "csv", m)
		if err != nil || len(b.Rows) != 2 || b.Rows[0].Error != "" || b.Rows[1].Error == "" {
			t.Fatalf("%q %+v %v", separator, b, err)
		}
	}
	for _, content := range []string{"", "\xff", "date;desc;amount\n\"unclosed"} {
		if _, err := Parse("a", "bad.csv", content, "csv", mapping()); err == nil {
			t.Fatal("arquivo inválido aceito")
		}
	}
}
func TestOFXSGMLAndValidation(t *testing.T) {
	content := `OFXHEADER:100
<OFX><CURDEF>BRL<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261021120000[-3:BRT]<TRNAMT>-123.45<FITID>synthetic-1<MEMO>Loja</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261022<TRNAMT>-10.00<MEMO>Errado</STMTTRN></OFX>`
	b, err := Parse("a", "test.ofx", content, "ofx", mapping())
	if err != nil {
		t.Fatal(err)
	}
	if len(b.Rows) != 2 || b.Rows[0].Cents != -12345 || b.Rows[0].Date != "2026-10-21" || b.Rows[0].Error != "" || b.Rows[1].Error == "" {
		t.Fatalf("OFX: %+v", b.Rows)
	}
	if _, err := Parse("a", "test.ofx", strings.ReplaceAll(content, "BRL", "USD"), "ofx", mapping()); err == nil {
		t.Fatal("moeda não recusada")
	}
}
