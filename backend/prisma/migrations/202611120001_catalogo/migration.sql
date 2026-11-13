ALTER TABLE test_catalog ADD COLUMN department VARCHAR(100) NOT NULL DEFAULT 'General', ADD COLUMN status BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE catalog_audit (
 id INTEGER NOT NULL AUTO_INCREMENT,
 tenantId INTEGER NOT NULL,
 kind VARCHAR(20) NOT NULL,
 itemId INTEGER NOT NULL,
 userName VARCHAR(150) NOT NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `before` JSON NULL,
 `after` JSON NOT NULL,
 PRIMARY KEY(id),
 INDEX catalog_audit_tenantId_kind_itemId_idx(tenantId, kind, itemId)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
