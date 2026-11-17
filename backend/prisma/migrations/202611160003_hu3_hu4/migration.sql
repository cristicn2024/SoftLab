ALTER TABLE `test_catalog`
  ADD COLUMN `container_type` VARCHAR(100) NULL,
  ADD COLUMN `sample_volume` DECIMAL(10,3) NULL,
  ADD COLUMN `sample_volume_unit` VARCHAR(20) NULL,
  ADD COLUMN `fasting_hours` INTEGER NULL,
  ADD COLUMN `preparation_instructions` TEXT NULL,
  ADD COLUMN `medication_warnings` TEXT NULL,
  ADD COLUMN `additional_instructions` TEXT NULL;

ALTER TABLE `orders`
  ADD COLUMN `pre_analytical_snapshot` JSON NULL;

CREATE TABLE `study_admission_exceptions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `order_id` INTEGER NOT NULL,
  `patient_id` INTEGER NOT NULL,
  `test_id` INTEGER NOT NULL,
  `authorized_by_id` INTEGER NULL,
  `authorized_by_name` VARCHAR(150) NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `study_admission_exceptions_tenant_id_order_id_idx` (`tenant_id`, `order_id`),
  INDEX `study_admission_exceptions_tenant_id_patient_id_idx` (`tenant_id`, `patient_id`),
  CONSTRAINT `study_admission_exceptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `study_admission_exceptions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `study_admission_exceptions_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `study_admission_exceptions_test_id_fkey` FOREIGN KEY (`test_id`) REFERENCES `test_catalog` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `study_admission_exceptions_authorized_by_id_fkey` FOREIGN KEY (`authorized_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
