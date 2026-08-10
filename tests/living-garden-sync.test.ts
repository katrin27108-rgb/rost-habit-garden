import assert from "node:assert/strict";
import test from "node:test";
import {
  LIVING_GARDEN_VERSION,
  completedDaysFor,
  habitDaysFor,
  livingDecorations,
  livingGardenPoints,
  mergeLivingGardenSnapshots,
  sanitizeLivingGardenSnapshot,
  unlockedLivingSpecies,
  type LivingGardenSnapshot,
  type LivingPlantHabit,
} from "../lib/living-garden-sync.ts";

function plant(overrides: Partial<LivingPlantHabit> = {}): LivingPlantHabit {
  return {
    id: "walk",
    habit: "Гулять 30 минут",
    species: "sunflower",
    baseCompletedDays: 11,
    completionDates: [],
    continuationDates: [],
    goalDays: 30,
    rewardedGoals: [],
    frequency: "daily",
    reminder: "18:30",
    createdAt: "2026-08-10T10:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-08-10T10:00:00.000Z",
    ...overrides,
  };
}

function snapshot(plants: LivingPlantHabit[]): LivingGardenSnapshot {
  return { version: LIVING_GARDEN_VERSION, plants, claimedAchievements: [], purchases: [] };
}

test("restores the previous completedDays format", () => {
  const restored = sanitizeLivingGardenSnapshot({
    version: 1,
    plants: [{ id: "read", habit: "Читать", species: "lavender", completedDays: 7, frequency: "daily", reminder: null }],
    claimedAchievements: [],
    purchases: [],
  });

  assert.ok(restored);
  assert.equal(restored.plants[0].baseCompletedDays, 7);
  assert.equal(completedDaysFor(restored.plants[0]), 7);
});

test("combines completion dates made on two devices", () => {
  const computer = snapshot([plant({ completionDates: ["2026-08-10"] })]);
  const phone = snapshot([plant({ completionDates: ["2026-08-11"], updatedAt: "2026-08-11T10:00:00.000Z" })]);
  const merged = mergeLivingGardenSnapshots(computer, phone);

  assert.deepEqual(merged.plants[0].completionDates, ["2026-08-10", "2026-08-11"]);
  assert.equal(completedDaysFor(merged.plants[0]), 13);
});

test("does not count the same completion or purchase twice", () => {
  const purchase = { id: "buy-peony", kind: "species" as const, target: "peony", price: 160, createdAt: "2026-08-10T11:00:00.000Z" };
  const left = { ...snapshot([plant({ completionDates: ["2026-08-10"] })]), claimedAchievements: ["first-roots"], purchases: [purchase] };
  const right = { ...snapshot([plant({ completionDates: ["2026-08-10"] })]), claimedAchievements: ["first-roots"], purchases: [purchase] };
  const merged = mergeLivingGardenSnapshots(left, right);

  assert.equal(merged.plants[0].completionDates.length, 1);
  assert.equal(merged.purchases.length, 1);
  assert.equal(livingGardenPoints(merged), 10);
  assert.ok(unlockedLivingSpecies(merged).includes("peony"));
});

test("sanitizes purchase prices and restores decorations", () => {
  const restored = sanitizeLivingGardenSnapshot({
    version: 1,
    plants: [plant()],
    claimedAchievements: [],
    purchases: [{ id: "stones", kind: "decoration", target: "stones", plantId: "walk", price: 1, createdAt: "2026-08-10T12:00:00.000Z" }],
  });

  assert.ok(restored);
  assert.equal(restored.purchases[0].price, 75);
  assert.equal(livingDecorations(restored).walk, "stones");
});

test("restores a completion date for an older finished plant", () => {
  const restored = sanitizeLivingGardenSnapshot({
    version: 1,
    plants: [{ ...plant({ baseCompletedDays: 29 }), completionDates: ["2026-08-30"], completedAt: undefined }],
    claimedAchievements: [],
    purchases: [],
  });

  assert.ok(restored);
  assert.equal(restored.plants[0].completedAt, "2026-08-30T00:00:00.000Z");
});

test("keeps a finished plant and its earliest completion date when devices merge", () => {
  const computer = snapshot([plant({ baseCompletedDays: 29, completionDates: ["2026-08-30"], completedAt: "2026-08-30T18:00:00.000Z" })]);
  const phone = snapshot([plant({ baseCompletedDays: 29, completionDates: ["2026-08-30"], completedAt: "2026-08-30T18:05:00.000Z", updatedAt: "2026-08-30T18:05:00.000Z" })]);
  const merged = mergeLivingGardenSnapshots(computer, phone);

  assert.equal(completedDaysFor(merged.plants[0]), 30);
  assert.equal(merged.plants[0].completedAt, "2026-08-30T18:00:00.000Z");
  assert.equal(livingGardenPoints(merged), 190);
});

test("keeps an achieved 30-day success while the habit continues to 60 days", () => {
  const restored = sanitizeLivingGardenSnapshot({
    version: 1,
    plants: [plant({ baseCompletedDays: 30, goalDays: 60, continuationDates: ["2026-09-01", "2026-09-02"], rewardedGoals: [30], completedAt: "2026-08-30T18:00:00.000Z" })],
    claimedAchievements: [],
    purchases: [],
  });

  assert.ok(restored);
  assert.equal(habitDaysFor(restored.plants[0]), 32);
  assert.equal(restored.plants[0].goalDays, 60);
  assert.equal(restored.plants[0].completedAt, "2026-08-30T18:00:00.000Z");
  assert.deepEqual(restored.plants[0].rewardedGoals, [30]);
});

test("merges continuation dates and awards a newly reached extended goal once", () => {
  const computer = snapshot([plant({ baseCompletedDays: 30, goalDays: 60, continuationDates: Array.from({ length: 15 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`,), rewardedGoals: [30], completedAt: "2026-08-30T18:00:00.000Z" })]);
  const phone = snapshot([plant({ baseCompletedDays: 30, goalDays: 60, continuationDates: Array.from({ length: 15 }, (_, index) => `2026-09-${String(index + 16).padStart(2, "0")}`,), rewardedGoals: [30], completedAt: "2026-08-30T18:00:00.000Z", updatedAt: "2026-09-30T18:00:00.000Z" })]);
  const merged = mergeLivingGardenSnapshots(computer, phone);

  assert.equal(habitDaysFor(merged.plants[0]), 60);
  assert.deepEqual(merged.plants[0].rewardedGoals, [30, 60]);
  assert.equal(livingGardenPoints(merged), 540);
});
