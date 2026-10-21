-- Correção por pagamento: parcelas e recorrências compartilham compra, mas não a correção.
CREATE TABLE IF NOT EXISTS payment_category_overrides (
    payment_id UUID PRIMARY KEY REFERENCES payments(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN
        ('FOOD','MARKET','TRANSPORT','HEALTH','ENTERTAINMENT','SHOPPING','HOUSING','BILLS','EDUCATION','PEOPLE','OTHER')),
    source TEXT NOT NULL CHECK (source IN ('manual','rule')),
    rule_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION effective_payment_category(payment UUID, imported TEXT)
RETURNS TEXT LANGUAGE SQL STABLE AS $$
    SELECT COALESCE((SELECT category FROM payment_category_overrides WHERE payment_id = payment), imported)
$$;
