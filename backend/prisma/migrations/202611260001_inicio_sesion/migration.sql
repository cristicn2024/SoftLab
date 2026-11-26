-- AlterTable
ALTER TABLE `users` ADD COLUMN `access_role_id` INTEGER NULL,
    ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `access_roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `permissions` JSON NOT NULL,

    UNIQUE INDEX `access_roles_tenant_id_code_key`(`tenant_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_branches` (
    `user_id` INTEGER NOT NULL,
    `branch_id` INTEGER NOT NULL,

    PRIMARY KEY (`user_id`, `branch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_sessions` (
    `digest` CHAR(64) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `branch_id` INTEGER NULL,
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `auth_sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`digest`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `key` CHAR(64) NOT NULL,
    `count` INTEGER NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `login_attempts_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(20) NOT NULL,
    `login` VARCHAR(150) NOT NULL,
    `tenantId` INTEGER NULL,
    `userId` INTEGER NULL,
    `branchId` INTEGER NULL,
    `ip` VARCHAR(45) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_access_role_id_fkey` FOREIGN KEY (`access_role_id`) REFERENCES `access_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `access_roles` ADD CONSTRAINT `access_roles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_branches` ADD CONSTRAINT `user_branches_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_branches` ADD CONSTRAINT `user_branches_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT IGNORE INTO access_roles (tenant_id, code, name, permissions)
SELECT id, 'admin', 'Administración', JSON_ARRAY('ordenes', 'catalogo', 'catalogo.editar', 'cobro', 'caja', 'entrega', 'resultados', 'referencias', 'plantillas') FROM tenants;

INSERT IGNORE INTO access_roles (tenant_id, code, name, permissions)
SELECT id, 'receptionist', 'Recepción', JSON_ARRAY('ordenes', 'cobro', 'caja', 'entrega', 'catalogo') FROM tenants;

INSERT IGNORE INTO access_roles (tenant_id, code, name, permissions)
SELECT id, 'chemist', 'Química', JSON_ARRAY('resultados', 'referencias', 'entrega', 'catalogo') FROM tenants;

INSERT IGNORE INTO access_roles (tenant_id, code, name, permissions)
SELECT id, 'doctor', 'Médico', JSON_ARRAY('entrega') FROM tenants;

UPDATE users u JOIN access_roles r ON r.tenant_id = u.tenant_id AND r.code = CONVERT(u.role USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET u.access_role_id = r.id WHERE u.access_role_id IS NULL;

CREATE TRIGGER IF NOT EXISTS auth_events_no_update BEFORE UPDATE ON auth_events
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bitácora de autenticación es inmutable';
CREATE TRIGGER IF NOT EXISTS auth_events_no_delete BEFORE DELETE ON auth_events
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bitácora de autenticación es inmutable';
