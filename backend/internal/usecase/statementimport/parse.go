// Package statementimport valida extratos sem gravar lançamentos financeiros.
package statementimport

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

const MaxRows = 2000
const MaxBytes = 2 << 20

func digest(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func Parse(account, filename, content, format string, m domain.StatementMapping) (domain.StatementBatch, error) {
	b := domain.StatementBatch{AccountID: account, Filename: filename, Hash: digest(content), Rows: []domain.StatementRow{}}
	if len(content) == 0 || len(content) > MaxBytes || !utf8.ValidString(content) {
		return b, fmt.Errorf("%w: arquivo vazio, acima de 2 MB ou fora de UTF-8", domain.ErrStatementInvalid)
	}
	var err error
	switch strings.ToLower(format) {
	case "csv":
		b.Rows, err = parseCSV(content, m)
	case "ofx":
		b.Rows, err = parseOFX(content)
	default:
		err = fmt.Errorf("formato deve ser CSV ou OFX")
	}
	if err != nil {
		return b, fmt.Errorf("%w: %v", domain.ErrStatementInvalid, err)
	}
	if len(b.Rows) == 0 || len(b.Rows) > MaxRows {
		return b, fmt.Errorf("%w: use de 1 a %d movimentos", domain.ErrStatementInvalid, MaxRows)
	}
	occurrences := map[string]int{}
	for i := range b.Rows {
		row := &b.Rows[i]
		row.Candidates = []domain.StatementCandidate{}
		if row.Error != "" {
			continue
		}
		key := row.Fingerprint
		if key != "" && occurrences[key] > 0 {
			row.Error = "FITID repetido no arquivo"
			continue
		}
		if key == "" {
			key = digest(fmt.Sprintf("%s|%s|%d", row.Date, strings.ToLower(strings.Join(strings.Fields(row.Description), " ")), row.Cents))
		}
		occurrences[key]++
		row.Fingerprint = digest(fmt.Sprintf("%s|%d", key, occurrences[key]))
	}
	return b, nil
}

var moneyBR = regexp.MustCompile(`^[+-]?(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+)(?:,[0-9]{1,2})?$`)
var moneyDot = regexp.MustCompile(`^[+-]?[0-9]+(?:\.[0-9]{1,2})?$`)

func cents(raw, decimal string) (int64, error) {
	s := strings.TrimSpace(raw)
	s = strings.TrimSpace(strings.TrimPrefix(s, "R$"))
	re := moneyDot
	if decimal == "," {
		re = moneyBR
	}
	if !re.MatchString(s) {
		return 0, fmt.Errorf("valor ou sinal inválido")
	}
	if decimal == "," {
		s = strings.ReplaceAll(s, ".", "")
		s = strings.ReplaceAll(s, ",", ".")
	}
	negative := strings.HasPrefix(s, "-")
	s = strings.TrimLeft(s, "+-")
	parts := strings.Split(s, ".")
	whole, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || whole > 9999999999 {
		return 0, fmt.Errorf("valor fora do limite")
	}
	n := whole * 100
	if len(parts) == 2 {
		fraction := parts[1]
		if len(fraction) == 1 {
			fraction += "0"
		}
		v, _ := strconv.ParseInt(fraction, 10, 64)
		n += v
	}
	if n == 0 {
		return 0, fmt.Errorf("valor zero")
	}
	if negative {
		n = -n
	}
	return n, nil
}
func parseCSV(content string, m domain.StatementMapping) ([]domain.StatementRow, error) {
	if m.Date < 0 || m.Description < 0 || m.Amount < 0 || m.Currency < -1 || m.Date == m.Description || m.Date == m.Amount || m.Description == m.Amount || (m.Decimal != "." && m.Decimal != ",") {
		return nil, fmt.Errorf("mapeamento inválido")
	}
	layout := "2006-01-02"
	switch m.DateFormat {
	case "DMY":
		layout = "02/01/2006"
	case "YMD":
	default:
		return nil, fmt.Errorf("formato de data inválido")
	}
	content = strings.TrimPrefix(content, "\ufeff")
	first, _, _ := strings.Cut(content, "\n")
	separator := ';'
	if strings.Count(first, "\t") > strings.Count(first, ";") {
		separator = '\t'
	} else if strings.Count(first, ";") == 0 {
		separator = ','
	}
	reader := csv.NewReader(strings.NewReader(content))
	reader.Comma = separator
	reader.FieldsPerRecord = -1
	rows := []domain.StatementRow{}
	number := 0
	for {
		fields, err := reader.Read()
		if err == io.EOF {
			break
		}
		number++
		if err != nil {
			return nil, fmt.Errorf("CSV inválido na linha %d", number)
		}
		if number == 1 && m.Header {
			continue
		}
		if len(rows) >= MaxRows {
			return nil, fmt.Errorf("limite de linhas excedido")
		}
		row := domain.StatementRow{Number: number}
		max := m.Date
		for _, v := range []int{m.Description, m.Amount, m.Currency} {
			if v > max {
				max = v
			}
		}
		if max >= len(fields) {
			row.Error = "coluna ausente"
			rows = append(rows, row)
			continue
		}
		row.Description = strings.TrimSpace(fields[m.Description])
		day, err := time.Parse(layout, strings.TrimSpace(fields[m.Date]))
		if err != nil {
			row.Error = "data inválida"
		} else {
			row.Date = day.Format("2006-01-02")
		}
		row.Cents, err = cents(fields[m.Amount], m.Decimal)
		if err != nil {
			row.Error = err.Error()
		}
		if row.Description == "" || utf8.RuneCountInString(row.Description) > 500 {
			row.Error = "descrição vazia ou acima de 500 caracteres"
		}
		if m.Currency >= 0 && strings.ToUpper(strings.TrimSpace(fields[m.Currency])) != "BRL" {
			row.Error = "moeda deve ser BRL"
		}
		rows = append(rows, row)
	}
	return rows, nil
}

var ofxTransactions = regexp.MustCompile(`(?is)<STMTTRN>(.*?)</STMTTRN>`)

func tag(block, name string) string {
	re := regexp.MustCompile(`(?is)<` + name + `>\s*([^<\r\n]+)`)
	m := re.FindStringSubmatch(block)
	if len(m) < 2 {
		return ""
	}
	return strings.TrimSpace(m[1])
}
func parseOFX(content string) ([]domain.StatementRow, error) {
	upper := strings.ToUpper(content)
	if strings.Contains(upper, "<CCSTMTRS>") || strings.Count(upper, "<STMTRS>") > 1 {
		return nil, fmt.Errorf("use um único extrato bancário por arquivo; cartões não são aceitos")
	}
	if !strings.Contains(strings.ToUpper(content), "<OFX>") || tag(content, "CURDEF") != "BRL" {
		return nil, fmt.Errorf("OFX inválido ou moeda diferente de BRL")
	}
	blocks := ofxTransactions.FindAllStringSubmatch(content, MaxRows+1)
	rows := []domain.StatementRow{}
	for i, block := range blocks {
		s := block[1]
		row := domain.StatementRow{Number: i + 1, Description: tag(s, "MEMO")}
		if row.Description == "" {
			row.Description = tag(s, "NAME")
		}
		date := tag(s, "DTPOSTED")
		if len(date) >= 8 {
			day, err := time.Parse("20060102", date[:8])
			if err == nil {
				row.Date = day.Format("2006-01-02")
			}
		}
		if row.Date == "" {
			row.Error = "data inválida"
		}
		var err error
		row.Cents, err = cents(tag(s, "TRNAMT"), ".")
		if err != nil {
			row.Error = err.Error()
		}
		kind := strings.ToUpper(tag(s, "TRNTYPE"))
		if (kind == "DEBIT" && row.Cents > 0) || (kind == "CREDIT" && row.Cents < 0) {
			row.Error = "sinal incompatível com TRNTYPE"
		}
		if row.Description == "" || utf8.RuneCountInString(row.Description) > 500 {
			row.Error = "descrição vazia ou acima de 500 caracteres"
		}
		if fit := tag(s, "FITID"); fit != "" {
			row.Fingerprint = digest("ofx:" + fit)
		}
		rows = append(rows, row)
	}
	return rows, nil
}
