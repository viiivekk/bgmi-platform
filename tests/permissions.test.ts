import { describe, expect, it } from "vitest";
import { assertCan, can, ForbiddenError } from "../src/auth/permissions";

const u = (role: any, grants: any[] = []) => ({ id: "u", role, grants });

describe("permissions", () => {
  it("super admin can do anything", () => expect(can(u("SUPER_ADMIN"), "anything:at-all")).toBe(true));
  it("tournament manager can approve results but not moderate", () => {
    expect(can(u("TOURNAMENT_MANAGER"), "results:approve")).toBe(true);
    expect(can(u("TOURNAMENT_MANAGER"), "moderation:remove")).toBe(false);
  });
  it("analyst is read-only", () => {
    expect(can(u("ANALYST"), "analytics:read")).toBe(true);
    expect(can(u("ANALYST"), "results:write")).toBe(false);
    expect(can(u("ANALYST"), "results:approve")).toBe(false);
  });
  it("moderator has moderation wildcard only", () => {
    expect(can(u("MODERATOR"), "moderation:hide-post")).toBe(true);
    expect(can(u("MODERATOR"), "results:read")).toBe(false);
  });
  it("plain users have no admin permissions", () => expect(can(u("USER"), "results:read")).toBe(false));
  it("scoped grants apply only to their tournament", () => {
    const user = u("USER", [{ permission: "results:approve", scopeType: "TOURNAMENT", scopeId: "T1" }]);
    expect(can(user, "results:approve", { type: "TOURNAMENT", id: "T1" })).toBe(true);
    expect(can(user, "results:approve", { type: "TOURNAMENT", id: "T2" })).toBe(false);
    expect(can(user, "results:approve")).toBe(false);
  });
  it("assertCan throws ForbiddenError", () => expect(() => assertCan(u("USER"), "results:write")).toThrow(ForbiddenError));
});
