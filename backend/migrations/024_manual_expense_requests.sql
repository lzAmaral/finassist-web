-- Recibo e chave de retentativa são confirmados junto com a compra e o pagamento.
CREATE TABLE IF NOT EXISTS manual_expense_requests (
    request_id UUID PRIMARY KEY CHECK (request_id <> '00000000-0000-0000-0000-000000000000'),
    fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
    purchase_id UUID NOT NULL REFERENCES purchases(id),
    payment_id UUID NOT NULL UNIQUE REFERENCES payments(id),
    financial_date DATE NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999999),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
