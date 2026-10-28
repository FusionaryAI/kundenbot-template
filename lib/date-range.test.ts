import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_RANGE_DAYS, parseDateRange } from "./date-range.ts";

const now = new Date("2026-10-28T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

test("ohne Angaben: die letzten 30 Tage", () => {
  const { from, to } = parseDateRange(null, null, now);
  assert.equal(to.getTime(), now.getTime());
  assert.equal(now.getTime() - from.getTime(), 30 * DAY);
});

test("übernimmt einen gültigen Zeitraum unverändert", () => {
  const { from, to } = parseDateRange("2026-09-01", "2026-09-30", now);
  assert.equal(from.toISOString().slice(0, 10), "2026-09-01");
  assert.equal(to.toISOString().slice(0, 10), "2026-09-30");
});

test("kappt extreme Zeiträume auf höchstens 366 Tage", () => {
  const { from, to } = parseDateRange("-271821-04-20", "+275760-09-13", now);
  assert.ok(to.getTime() - from.getTime() <= MAX_RANGE_DAYS * DAY);
  assert.ok(!isNaN(from.getTime()) && !isNaN(to.getTime()));
});

test("vertauschte oder ungültige Angaben fallen auf Standardwerte zurück", () => {
  const swapped = parseDateRange("2026-10-01", "2026-09-01", now);
  assert.ok(swapped.from <= swapped.to);
  const garbage = parseDateRange("kein-datum", "auch-nicht", now);
  assert.equal(garbage.to.getTime(), now.getTime());
});
