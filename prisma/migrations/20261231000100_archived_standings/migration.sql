-- CreateTable
CREATE TABLE `ArchivedStanding` (
    `id` CHAR(36) NOT NULL,
    `tournamentKey` VARCHAR(191) NOT NULL,
    `tournamentName` VARCHAR(191) NOT NULL,
    `organiser` VARCHAR(191) NULL,
    `tournamentDates` VARCHAR(191) NULL,
    `stageName` VARCHAR(191) NOT NULL,
    `stageOrder` INTEGER NOT NULL,
    `rank` INTEGER NOT NULL,
    `teamName` VARCHAR(191) NOT NULL,
    `matchesPlayed` INTEGER NOT NULL,
    `wins` INTEGER NULL,
    `positionPoints` INTEGER NULL,
    `finishPoints` INTEGER NULL,
    `totalPoints` INTEGER NOT NULL,
    `qualified` VARCHAR(191) NULL,
    `sourceUrls` JSON NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ArchivedStanding_tournamentKey_stageOrder_idx`(`tournamentKey`, `stageOrder`),
    UNIQUE INDEX `ArchivedStanding_tournamentKey_stageName_rank_key`(`tournamentKey`, `stageName`, `rank`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
