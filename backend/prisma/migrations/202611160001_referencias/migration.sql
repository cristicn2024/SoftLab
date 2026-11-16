ALTER TABLE patients ADD COLUMN special_condition VARCHAR(100) NULL, ADD COLUMN pregnancy_weeks INTEGER NULL;
ALTER TABLE test_results ADD COLUMN reference_snapshot TEXT NULL;
CREATE TABLE reference_versions (
 id INTEGER NOT NULL AUTO_INCREMENT,
 tenant_id INTEGER NOT NULL,
 test_id INTEGER NOT NULL,
 parameter_id INTEGER NOT NULL,
 effective_from DATETIME(3) NOT NULL,
 rules JSON NOT NULL,
 user_name VARCHAR(150) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id),
 UNIQUE INDEX reference_versions_tenant_id_parameter_id_effective_from_key(tenant_id,parameter_id,effective_from)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
