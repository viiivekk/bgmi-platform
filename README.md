# Esports Tournament & Community Platform (BGMI-format) — core engine, phase 1

A tournament-management and social platform for battle-royale esports, on **MySQL 8 + Prisma 7 + TypeScript**.
This is **phase 1**: architecture, full database schema, and the tested core tournament engine. UI, auth,
social features and the admin portal come next (see Roadmap). There is no official BGMI API; all results are
entered or imported by authorized staff, and nothing here pretends otherwise.

Neutral branding by default (`BRAND_NAME`). Use KRAFTON/BGMI marks only with written authorization.

## Status — what is verified and what is not

| Area | State |
|---|---|
| Prisma schema (MySQL): users, teams, rosters, tournaments, stages, groups, matches, lobbies, versioned results, standings, player stats, social, moderation, audit | `prisma validate` + `prisma generate` pass |
| Engine: scoring, validation, standings, tiebreakers, player stats, CSV/JSON import, approval planner, permissions | **45 unit tests pass**, `tsc --strict` clean |
| `prisma/constraints.sql` | **Executed on a real MySQL 8.0 server** against Prisma-shaped tables: applies cleanly; a 2nd APPROVED set for a match is rejected; CHECKs reject bad rows |
| Approval locking strategy | Tested on MySQL 8.0 with two sessions (see "Concurrency") |
| DB service `src/services/results.ts` + `src/db.ts` | Type-checked against the generated client. **Not yet run end-to-end**: the build sandbox could not download Prisma's migration engine, so the full schema was never created there |
| Next.js UI, auth, realtime, social, admin portal, PDF/CSV export | Not started |

## Design decisions

- **Official standings come only from APPROVED result sets.** Drafts, submitted and rejected sets never count.
- **Results are versioned, never edited.** A correction (reason mandatory) is a new draft that, once approved,
  marks the old set `SUPERSEDED`. The database enforces one approved set per match.
- **Approval is one transaction**: lock tournament row → supersede old set → snapshot points + scoring config →
  rebuild standings for the stage/group and player stats for the tournament → write the audit log.
- **Four-eyes by default:** approver must differ from submitter (`ALLOW_SELF_APPROVAL=false`).
- **Validation before approval:** unique contiguous placements, lobby and roster membership, eliminations capped
  at players-in-lobby minus one, player rows reconciled with team totals.
- **No invented stats.** Optional stats (assists, damage, survival) stay `null` when not supplied, with sample counts.
- **Every match belongs to a group.** A stage without real groups uses one group (e.g. "All"), which keeps
  standings and match numbering uniquely constrained without NULL tricks.
- **Server-side authorization** in `src/auth/permissions.ts`: role defaults + scoped per-user grants.
- `EXAMPLE_SCORING_TEMPLATE` is only a starting point; each tournament stores its own validated `scoringConfig`.

## MySQL specifics

- **IDs** are `CHAR(36)` UUIDs; long text uses `TEXT`; enums are native MySQL ENUMs.
- **One approved result per match:** MySQL has no partial unique index, so `ResultSet.approvedMatchId` is a
  generated column (`matchId` while APPROVED, else NULL) with a unique index (created in `constraints.sql`).
  **Never write that field.**
- **CHECK constraints** cover tournament sizes and result values. MySQL forbids CHECKs on columns that have FK
  referential actions, so "can't follow yourself" and "a like targets exactly one of post/comment" are enforced
  in the social service layer (phase 4), not the DB.
- **Concurrency:** approvals lock the `Tournament` row (`SELECT ... FOR UPDATE`) and run at **READ COMMITTED**.
  This is deliberate: under MySQL's default REPEATABLE READ, a second approver that had already read data would
  keep seeing its old snapshot after the lock is released and act on stale state (reproduced on MySQL 8.0).
- Default collation is case-insensitive, which suits IGNs, team names and hashtags.
- Needs MySQL **8.0.16+** (CHECK enforcement, generated-column indexes).

## Layout

```
prisma/schema.prisma      normalized schema (Prisma 7, MySQL)
prisma/constraints.sql    CHECKs + generated-column unique index Prisma can't express
src/db.ts                 Prisma client via the MariaDB/MySQL driver adapter
src/engine/               pure, unit-tested logic
src/services/results.ts   transactional DB workflow built on the engine
src/auth/permissions.ts   roles, grants, assertCan
tests/                    vitest suites
```

## Setup

```bash
# 1. MySQL 8 (Docker shown; or install locally and create an empty database "esports")
docker run -d --name esports-db -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=esports mysql:8.4

# 2. App
cp .env.example .env            # Windows: copy .env.example .env
npm install                     # also runs prisma generate
npx prisma migrate dev --name init
```

`prisma migrate dev` needs a MySQL user allowed to create databases (it uses a temporary shadow database);
the Docker `root` user works. Then add the extra constraints as a second migration:

```bash
mkdir prisma/migrations/20260101000000_constraints
cp prisma/constraints.sql prisma/migrations/20260101000000_constraints/migration.sql
npx prisma migrate dev          # applies it
npm test && npm run typecheck
npx prisma studio               # optional: browse tables
```

Requires Node 20+ and MySQL 8.0.16+. In production use `prisma migrate deploy` and a non-root DB user.

## Roadmap

1. Run migrations and add DB integration tests: register → schedule → score → approve → correct, plus a concurrent-approval test.
2. Auth (hashed passwords, sessions, rate limiting) and API routes with zod validation and pagination.
3. Next.js + Tailwind UI shell (dark esports theme), public pages, live standings over WebSocket/SSE (publish the `DomainEvent`s returned by `approveResultSet` after commit).
4. Social: profiles, posts/media (S3-compatible), feed, follows, likes, comments, search, notifications, blocking, reports.
5. `/admin` portal with RBAC, moderation, analytics, CSV/PDF export, audit-log viewer.
6. Fictional seed data; deployment guide (Docker, managed MySQL, CI).

## Known limitations

- Standings recompute is a full rebuild per stage/group; fine at league scale.
- Brackets, group seeding and advancement are modelled (stages, groups, `advancingTeams`) but not implemented.
- Manager permissions are platform-wide by role; narrower access is possible with scoped `PermissionGrant`s.
