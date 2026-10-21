-- Prévia guarda dados estruturados validados; o arquivo original não é armazenado.
CREATE TABLE IF NOT EXISTS statement_import_batches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id UUID NOT NULL REFERENCES accounts(id),
 filename TEXT NOT NULL,
 file_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PREVIEW' CHECK (status IN ('PREVIEW','CONFIRMED','REVERTED')),
 payload JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(account_id,file_hash)
);
CREATE TABLE IF NOT EXISTS statement_import_rows (
 batch_id UUID NOT NULL REFERENCES statement_import_batches(id),
 row_number INT NOT NULL,
 account_id UUID NOT NULL REFERENCES accounts(id),
 fingerprint TEXT NOT NULL,
 payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
 created BOOLEAN NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY(batch_id,row_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS statement_import_identity ON statement_import_rows(account_id,fingerprint) WHERE active;
