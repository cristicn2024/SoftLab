-- Additive support for HU 5.2 and HU 6.2. Existing rows and columns are preserved.
CREATE TABLE `practitioners` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `specialty` VARCHAR(120) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `practitioners_tenant_id_full_name_key` (`tenant_id`, `full_name`),
  CONSTRAINT `practitioners_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `test_catalog` ADD COLUMN `external_lab` VARCHAR(150) NULL, ADD COLUMN `turnaround_hours` INTEGER NULL;
ALTER TABLE `patients` ADD COLUMN `patient_code` VARCHAR(30) NULL;
CREATE UNIQUE INDEX `patients_tenant_id_patient_code_key` ON `patients` (`tenant_id`,`patient_code`);
ALTER TABLE `orders` ADD COLUMN `folio` VARCHAR(40) NULL, ADD COLUMN `physician_id` INTEGER NULL;
ALTER TABLE `samples` ADD COLUMN `received_at` DATETIME(3) NULL, ADD COLUMN `sample_description` VARCHAR(150) NULL, ADD COLUMN `equipment` VARCHAR(150) NULL, ADD COLUMN `captured_by_name` VARCHAR(150) NULL;
CREATE UNIQUE INDEX `orders_folio_key` ON `orders` (`folio`);
ALTER TABLE `orders` ADD CONSTRAINT `orders_physician_id_fkey` FOREIGN KEY (`physician_id`) REFERENCES `practitioners` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `test_results` ADD COLUMN `flag` VARCHAR(2) NULL, ADD COLUMN `parameter_id` INTEGER NULL;
CREATE UNIQUE INDEX `test_results_order_item_id_parameter_id_key` ON `test_results` (`order_item_id`, `parameter_id`);

CREATE TABLE `study_instructions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `tenant_id` INTEGER NOT NULL, `test_id` INTEGER NOT NULL,
  `type` ENUM('fasting','first_urine','medication','text') NOT NULL, `min_hours` INTEGER NULL, `max_hours` INTEGER NULL, `text` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `study_instructions_test_id_type_text_key` (`test_id`,`type`,`text`),
  CONSTRAINT `study_instructions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `study_instructions_test_id_fkey` FOREIGN KEY (`test_id`) REFERENCES `test_catalog` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `instruction_confirmations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `tenant_id` INTEGER NOT NULL, `order_id` INTEGER NOT NULL, `user_id` INTEGER NULL, `branch_id` INTEGER NOT NULL,
  `observation` VARCHAR(500) NULL, `confirmed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `instruction_confirmations_order_id_key` (`order_id`),
  CONSTRAINT `instruction_confirmations_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `instruction_confirmations_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `instruction_confirmations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `instruction_deliveries` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `tenant_id` INTEGER NOT NULL, `order_id` INTEGER NOT NULL, `user_id` INTEGER NULL,
  `channel` ENUM('whatsapp','email') NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  CONSTRAINT `instruction_deliveries_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `instruction_deliveries_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `instruction_deliveries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `test_parameters` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `tenant_id` INTEGER NOT NULL, `test_id` INTEGER NOT NULL, `name` VARCHAR(150) NOT NULL, `unit` VARCHAR(30) NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0, `qualitative_expected` VARCHAR(100) NULL, `previous_value` VARCHAR(255) NULL, `previous_date` VARCHAR(40) NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `test_parameters_test_id_name_key` (`test_id`,`name`),
  CONSTRAINT `test_parameters_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `test_parameters_test_id_fkey` FOREIGN KEY (`test_id`) REFERENCES `test_catalog` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reference_ranges` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `tenant_id` INTEGER NOT NULL, `test_id` INTEGER NOT NULL, `parameter_id` INTEGER NULL, `gender` ENUM('M','F','Other') NULL,
  `min_age_years` INTEGER NULL, `max_age_years` INTEGER NULL, `low` DECIMAL(12,4) NULL, `high` DECIMAL(12,4) NULL,
  `low_inclusive` BOOLEAN NOT NULL DEFAULT true, `high_inclusive` BOOLEAN NOT NULL DEFAULT true, `critical_low` DECIMAL(12,4) NULL, `critical_high` DECIMAL(12,4) NULL,
  `critical_low_inclusive` BOOLEAN NOT NULL DEFAULT false, `critical_high_inclusive` BOOLEAN NOT NULL DEFAULT false,
  `display` VARCHAR(100) NOT NULL, PRIMARY KEY (`id`),
  CONSTRAINT `reference_ranges_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `reference_ranges_test_id_fkey` FOREIGN KEY (`test_id`) REFERENCES `test_catalog` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `reference_ranges_parameter_id_fkey` FOREIGN KEY (`parameter_id`) REFERENCES `test_parameters` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `critical_notifications` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `tenant_id` INTEGER NOT NULL, `result_id` INTEGER NOT NULL, `user_id` INTEGER NULL, `branch_id` INTEGER NOT NULL,
  `recipient` ENUM('doctor','patient') NOT NULL, `recipient_name` VARCHAR(150) NOT NULL, `contact_method` ENUM('phone','email','whatsapp','in_person') NOT NULL,
  `notified_at` DATETIME(3) NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  CONSTRAINT `critical_notifications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `critical_notifications_result_id_fkey` FOREIGN KEY (`result_id`) REFERENCES `test_results` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `critical_notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `test_results` ADD CONSTRAINT `test_results_parameter_id_fkey` FOREIGN KEY (`parameter_id`) REFERENCES `test_parameters` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
