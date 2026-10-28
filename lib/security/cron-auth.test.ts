import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedCron } from "./cron-auth.ts";

test("ohne CRON_SECRET wird jeder Aufruf abgelehnt (fail-closed)", () => {
  assert.equal(isAuthorizedCron(null, undefined), false);
  assert.equal(isAuthorizedCron("Bearer ", undefined), false);
  assert.equal(isAuthorizedCron("Bearer ", ""), false);
});

test("nur der exakte Bearer-Wert wird akzeptiert", () => {
  assert.equal(isAuthorizedCron("Bearer s3cret-value", "s3cret-value"), true);
  assert.equal(isAuthorizedCron(null, "s3cret-value"), false);
  assert.equal(isAuthorizedCron("Bearer s3cret-valuX", "s3cret-value"), false);
  assert.equal(isAuthorizedCron("Bearer s3cret-value-longer", "s3cret-value"), false);
  assert.equal(isAuthorizedCron("bearer s3cret-value", "s3cret-value"), false);
});
