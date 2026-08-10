import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyGardenStatistic, livingMonthLabel, moveLivingMonth } from "../lib/living-garden-statistics.ts";
import type { LivingPlantHabit } from "../lib/living-garden-sync.ts";

function plant(id: string, frequency: LivingPlantHabit["frequency"], completionDates: string[], baseCompletedDays = 0, createdAt = "2026-08-01T10:00:00.000Z"): LivingPlantHabit {
  return { id, habit: id, species: "sunflower", baseCompletedDays, completionDates, continuationDates: [], goalDays: 30, rewardedGoals: [], frequency, reminder: null, createdAt, completedAt: baseCompletedDays + completionDates.length >= 30 ? "2026-08-10T10:00:00.000Z" : null, updatedAt: "2026-08-10T10:00:00.000Z" };
}

test("builds a current-month summary without treating future days as missed", () => {
  const result = buildMonthlyGardenStatistic([
    plant("daily", "daily", ["2026-08-01", "2026-08-03"]),
    plant("weekly", "weekly", ["2026-08-02"]),
    plant("three", "threeWeekly", ["2026-08-03", "2026-08-08"]),
  ], "2026-08", "2026-08-10");

  assert.equal(result.elapsedDays, 10);
  assert.equal(result.totalCompleted, 5);
  assert.equal(result.activeDays, 4);
  assert.deepEqual(result.plants.map((item) => item.target), [10, 2, 5]);
  assert.equal(result.target, 17);
  assert.equal(result.missed, 12);
  assert.equal(result.days[10].isFuture, true);
});

test("limits the monthly target when a plant reaches all 30 stages", () => {
  const result = buildMonthlyGardenStatistic([
    plant("almost-grown", "daily", ["2026-07-28", "2026-08-01"], 28),
  ], "2026-08", "2026-08-10");

  assert.equal(result.plants[0].target, 1);
  assert.equal(result.plants[0].completed, 1);
  assert.equal(result.plants[0].missed, 0);
  assert.equal(result.plants[0].rate, 100);
});

test("moves between years and formats a Russian month label", () => {
  assert.equal(moveLivingMonth("2026-01", -1), "2025-12");
  assert.match(livingMonthLabel("2026-08"), /Август 2026/);
});

test("does not invent missed days before a habit started", () => {
  const result = buildMonthlyGardenStatistic([
    plant("new", "daily", ["2026-08-10"], 0, "2026-08-10T09:00:00.000Z"),
  ], "2026-08", "2026-08-10");

  assert.equal(result.plants[0].target, 1);
  assert.equal(result.plants[0].missed, 0);
});

test("includes post-growth repetitions in an extended habit goal", () => {
  const extended = { ...plant("extended", "daily", [], 30), goalDays: 60, continuationDates: ["2026-08-01", "2026-08-02", "2026-08-03"], rewardedGoals: [30], completedAt: "2026-07-31T18:00:00.000Z" };
  const result = buildMonthlyGardenStatistic([extended], "2026-08", "2026-08-10");

  assert.equal(result.plants[0].completed, 3);
  assert.equal(result.plants[0].target, 10);
  assert.equal(result.plants[0].missed, 7);
});
