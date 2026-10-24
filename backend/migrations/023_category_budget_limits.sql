-- NULL remove o limite ativo preservando a revisão contra escritas antigas.
CREATE TABLE IF NOT EXISTS category_budget_limits (
    month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
    category TEXT NOT NULL CHECK (category IN ('FOOD','MARKET','TRANSPORT','HEALTH','ENTERTAINMENT','SHOPPING','HOUSING','BILLS','EDUCATION','PEOPLE','OTHER')),
    limit_cents BIGINT CHECK (limit_cents BETWEEN 0 AND 100000000000),
    version BIGINT NOT NULL CHECK (version > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (month, category)
);
