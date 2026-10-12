import { describe, expect, it } from "vitest";
import { decideSignIn, GRACE_PERIOD_DAYS } from "./sign-in-decision";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-06-01T12:00:00.000Z");
const deletedDaysAgo = (days: number) => new Date(now.getTime() - days * DAY);

describe("decideSignIn", () => {
  it("allows an active User", () => {
    expect(decideSignIn(null, now)).toBe("allow");
  });

  it("restores a User deleted 1 day ago", () => {
    expect(decideSignIn(deletedDaysAgo(1), now)).toBe("restore");
  });

  it("still restores a User deleted exactly 30 days ago", () => {
    expect(GRACE_PERIOD_DAYS).toBe(30);
    expect(decideSignIn(deletedDaysAgo(30), now)).toBe("restore");
  });

  it("refuses a User deleted 31 days ago", () => {
    expect(decideSignIn(deletedDaysAgo(31), now)).toBe("refuse");
  });

  it("refuses a User deleted a moment after the Grace period ended", () => {
    expect(decideSignIn(new Date(deletedDaysAgo(30).getTime() - 1), now)).toBe("refuse");
  });
});
