import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getAccountRoleMismatch,
  normalizeAccountRole,
} from "../src/utils/accountRole.js";

describe("account role validation", () => {
  it("normalizes supported roles and defaults unknown roles to candidate", () => {
    assert.equal(normalizeAccountRole("employer"), "employer");
    assert.equal(normalizeAccountRole("candidate"), "candidate");
    assert.equal(normalizeAccountRole(undefined), "candidate");
  });

  it("accepts a matching account role", () => {
    assert.equal(
      getAccountRoleMismatch({ accountType: "employer" }, "employer"),
      null
    );
  });

  it("returns a useful mismatch for the wrong login mode", () => {
    assert.deepEqual(
      getAccountRoleMismatch({ accountType: "candidate" }, "employer"),
      {
        actualRole: "candidate",
        expectedRole: "employer",
        message:
          "This account is registered as a candidate. Please select candidate to sign in.",
      }
    );
  });
});
