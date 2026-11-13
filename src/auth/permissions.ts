export type Role = "USER" | "SUPER_ADMIN" | "TOURNAMENT_MANAGER" | "ANALYST" | "MODERATOR";

/** Default permissions per role. Per-user grants (PermissionGrant rows) add to these. */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  USER: [],
  SUPER_ADMIN: ["*"],
  TOURNAMENT_MANAGER: ["tournament:*", "registration:review", "schedule:write", "results:read", "results:write", "results:approve", "results:correct", "team:write", "player:write"],
  ANALYST: ["results:read", "analytics:read", "export:read", "audit:read"],
  MODERATOR: ["moderation:*", "content:read"],
};

export interface Grant { permission: string; scopeType?: string | null; scopeId?: string | null }
export interface Actor { id: string; role: Role; grants?: Grant[] }

const matches = (held: string, wanted: string) =>
  held === "*" || held === wanted || (held.endsWith(":*") && wanted.startsWith(held.slice(0, -1)));

/** Server-side check. Call this in every service/route; never rely on the UI hiding buttons. */
export function can(actor: Actor, permission: string, scope?: { type: string; id: string }): boolean {
  if (ROLE_PERMISSIONS[actor.role].some((p) => matches(p, permission))) return true;
  return (actor.grants ?? []).some(
    (g) => matches(g.permission, permission) && (g.scopeId == null || (scope != null && g.scopeType === scope.type && g.scopeId === scope.id)),
  );
}

export class ForbiddenError extends Error {
  constructor(permission: string) { super(`missing permission: ${permission}`); this.name = "ForbiddenError"; }
}
export function assertCan(actor: Actor, permission: string, scope?: { type: string; id: string }): void {
  if (!can(actor, permission, scope)) throw new ForbiddenError(permission);
}
