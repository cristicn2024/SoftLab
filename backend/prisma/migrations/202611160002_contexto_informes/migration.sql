ALTER TABLE orders ADD COLUMN processed_at DATETIME(3) NULL, ADD COLUMN reference_condition VARCHAR(100) NULL, ADD COLUMN reference_weeks INTEGER NULL;
ALTER TABLE order_reports ADD COLUMN issued_pdf LONGTEXT NULL;
