CREATE TABLE `external_labs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `external_labs_tenant_id_name_key` (`tenant_id`, `name`),
  CONSTRAINT `external_labs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `test_catalog`
  ADD COLUMN `external_lab_id` INTEGER NULL,
  ADD COLUMN `turnaround_days` INTEGER NULL,
  ADD COLUMN `outsourcing_cost` DECIMAL(10,2) NULL,
  ADD INDEX `test_catalog_external_lab_id_idx` (`external_lab_id`),
  ADD CONSTRAINT `test_catalog_external_lab_id_fkey` FOREIGN KEY (`external_lab_id`) REFERENCES `external_labs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `shipment_orders` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `order_id` INTEGER NOT NULL,
  `test_id` INTEGER NOT NULL,
  `external_lab_id` INTEGER NOT NULL,
  `folio` VARCHAR(40) NOT NULL,
  `estimated_days` INTEGER NOT NULL,
  `outsourcing_cost` DECIMAL(10,2) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `shipment_orders_folio_key` (`folio`),
  INDEX `shipment_orders_tenant_id_created_at_idx` (`tenant_id`, `created_at`),
  INDEX `shipment_orders_order_id_idx` (`order_id`),
  INDEX `shipment_orders_test_id_idx` (`test_id`),
  INDEX `shipment_orders_external_lab_id_idx` (`external_lab_id`),
  CONSTRAINT `shipment_orders_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `shipment_orders_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `shipment_orders_test_id_fkey` FOREIGN KEY (`test_id`) REFERENCES `test_catalog` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `shipment_orders_external_lab_id_fkey` FOREIGN KEY (`external_lab_id`) REFERENCES `external_labs` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
