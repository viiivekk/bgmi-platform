-- MySQL 8.0.16+ : constraints Prisma cannot express. Apply as a second migration right after `init`.

ALTER TABLE `Tournament`        ADD CONSTRAINT tournament_sizes_pos CHECK (`maxTeams` > 0 AND `squadSize` > 0);
ALTER TABLE `TeamMatchResult`   ADD CONSTRAINT team_result_valid    CHECK (`placement` > 0 AND `eliminations` >= 0);
ALTER TABLE `PlayerMatchResult` ADD CONSTRAINT player_result_valid  CHECK (`eliminations` >= 0 AND (`assists` IS NULL OR `assists` >= 0) AND (`damage` IS NULL OR `damage` >= 0) AND (`survivalSeconds` IS NULL OR `survivalSeconds` >= 0));

-- Exactly one APPROVED result set per match. MySQL has no partial unique index, so `approvedMatchId`
-- (declared in schema.prisma as a plain column) is rebuilt as a generated column that equals matchId only
-- while the set is APPROVED (NULL otherwise; NULLs never collide in a unique index).
ALTER TABLE `ResultSet` DROP INDEX `ResultSet_approvedMatchId_key`;
ALTER TABLE `ResultSet` DROP COLUMN `approvedMatchId`;
ALTER TABLE `ResultSet` ADD COLUMN `approvedMatchId` CHAR(36) GENERATED ALWAYS AS (CASE WHEN `status` = 'APPROVED' THEN `matchId` ELSE NULL END) VIRTUAL;
ALTER TABLE `ResultSet` ADD UNIQUE INDEX `ResultSet_approvedMatchId_key` (`approvedMatchId`);

-- Not enforced here (MySQL forbids CHECK on columns with FK referential actions):
--   Follow: followerId <> followingId, Like: exactly one of postId/commentId.
--   These are enforced in the social service layer.
