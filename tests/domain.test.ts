import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditCompletion,
  dedupeRewardEvents,
  evaluateHabit,
  makeSeason,
  stableGardenSlot,
  starBalance,
  type DateKey,
  type DomainHabit,
  type ScheduleRule,
} from "../lib/domain.ts";
import { migrateLegacyHabits } from "../lib/app-model.ts";

function habit(rule: ScheduleRule, completions: DateKey[], startsOn: DateKey = "2026-07-01", duration = 14): DomainHabit {
  const season = makeSeason(startsOn, duration, rule, "season-1");
  return {
    id: "habit-1",
    name: "Тест",
    icon: "🌱",
    color: "#abc",
    plantKind: "oak",
    status: "active",
    season,
    completions: completions.map((localDate, index) => ({
      id: `completion-${index}`,
      habitId: "habit-1",
      seasonId: season.id,
      localDate,
      operationId: `operation-${index}`,
      createdAt: `${localDate}T08:00:00.000Z`,
    })),
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

test("daily progress never falls when days are missed", () => {
  const item = habit({ type: "daily" }, ["2026-07-01", "2026-07-02"]);
  const first = evaluateHabit(item, "2026-07-03");
  const later = evaluateHabit(item, "2026-07-08");
  assert.equal(first.progress, later.progress);
  assert.equal(later.completed, 2);
  assert.equal(later.missed, 5);
});

test("unscheduled weekdays are neutral for streaks", () => {
  const item = habit({ type: "weekdays", weekdays: [1, 3, 5] }, ["2026-07-01", "2026-07-03", "2026-07-06"]);
  const metrics = evaluateHabit(item, "2026-07-07");
  assert.equal(metrics.currentStreak, 3);
  assert.equal(metrics.missed, 0);
});

test("weekly target is not failed before the week closes", () => {
  const item = habit({ type: "weekly", times: 3 }, ["2026-07-01"]);
  const openWeek = evaluateHabit(item, "2026-07-03");
  const closedWeek = evaluateHabit(item, "2026-07-08");
  assert.equal(openWeek.missed, 0);
  assert.equal(closedWeek.missed, 2);
});

test("first miss does not punish health and pause protects it", () => {
  const item = habit({ type: "daily" }, []);
  assert.equal(evaluateHabit(item, "2026-07-03").health, 82);
  item.status = "paused";
  assert.equal(evaluateHabit(item, "2026-07-10").health, 100);
});

test("schedule versions preserve the past", () => {
  const item = habit({ type: "daily" }, ["2026-07-01", "2026-07-02"], "2026-07-01", 7);
  item.season.scheduleVersions[0].effectiveTo = "2026-07-02";
  item.season.scheduleVersions.push({ id: "v2", effectiveFrom: "2026-07-03", rule: { type: "weekdays", weekdays: [5] } });
  const metrics = evaluateHabit(item, "2026-07-08");
  assert.equal(metrics.planned, 3);
  assert.equal(metrics.completed, 2);
});

test("backdating is limited to today and three previous days", () => {
  assert.equal(canEditCompletion("2026-07-13", "2026-07-16"), true);
  assert.equal(canEditCompletion("2026-07-12", "2026-07-16"), false);
  assert.equal(canEditCompletion("2026-07-17", "2026-07-16"), false);
});

test("reward operation ids are idempotent", () => {
  const events = [
    { operationId: "same", code: "completion", stars: 1 },
    { operationId: "same", code: "completion", stars: 1 },
    { operationId: "bonus", code: "perfect-day", stars: 2 },
  ];
  assert.equal(dedupeRewardEvents(events).length, 2);
  assert.equal(starBalance(events), 3);
});

test("garden slots are stable and resolve collisions", () => {
  const first = stableGardenSlot("habit-a");
  assert.equal(first, stableGardenSlot("habit-a"));
  const occupied = new Set([first]);
  assert.notEqual(stableGardenSlot("habit-a", occupied), first);
});

test("legacy migration is deterministic and keeps every completion", () => {
  const legacy = [{ id: "water", name: "Стакан воды", icon: "💧", color: "#abc", completions: ["2026-07-01", "2026-07-01", "2026-07-02"] }];
  const first = migrateLegacyHabits(legacy, "2026-07-16");
  const second = migrateLegacyHabits(legacy, "2026-07-16");
  assert.deepEqual(first[0].completions, ["2026-07-01", "2026-07-02"]);
  assert.equal(first[0].gardenSlot, second[0].gardenSlot);
  assert.equal(first[0].endsOn, "2026-08-14");
});
