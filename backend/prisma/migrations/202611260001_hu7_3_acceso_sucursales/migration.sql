CREATE TABLE `user_branch_access` (
    `user_id` INTEGER NOT NULL,
    `branch_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_branch_access_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`user_id`, `branch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_branch_access`
    ADD CONSTRAINT `user_branch_access_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_branch_access`
    ADD CONSTRAINT `user_branch_access_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `user_branch_access` (`user_id`, `branch_id`)
SELECT `id`, `branch_id` FROM `users` WHERE `branch_id` IS NOT NULL;
