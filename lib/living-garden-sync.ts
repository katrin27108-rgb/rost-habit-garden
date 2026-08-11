export const LIVING_GARDEN_STORAGE_KEY = "rost-living-garden-v1";
export const LIVING_GARDEN_VERSION = 1;
export const LIVING_COMPLETION_REWARD = 60;

export type LivingSpeciesCode = "sunflower" | "tomato" | "lavender" | "monstera" | "oak" | "apple" | "peony" | "sakura";
export type LivingFrequency = "daily" | "weekly" | "threeWeekly" | "customWeekly";
export type LivingDecorationCode = "sign" | "lantern" | "stones";

export type LivingCompletionOverride = {
  date: string;
  completed: boolean;
  updatedAt: string;
};

export type LivingPlantHabit = {
  id: string;
  habit: string;
  species: LivingSpeciesCode;
  baseCompletedDays: number;
  completionDates: string[];
  continuationDates: string[];
  completionOverrides?: LivingCompletionOverride[];
  goalDays: number;
  rewardedGoals: number[];
  frequency: LivingFrequency;
  timesPerWeek?: number;
  reminder: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type LivingPurchase = {
  id: string;
  kind: "species" | "decoration" | "care";
  target: string;
  plantId?: string;
  price: number;
  createdAt: string;
};

export type LivingGardenSnapshot = {
  version: 1;
  plants: LivingPlantHabit[];
  claimedAchievements: string[];
  purchases: LivingPurchase[];
  deletedPlantIds?: string[];
};

const speciesCodes = new Set<LivingSpeciesCode>(["sunflower", "tomato", "lavender", "monstera", "oak", "apple", "peony", "sakura"]);
const frequencyCodes = new Set<LivingFrequency>(["daily", "weekly", "threeWeekly", "customWeekly"]);
const achievementRewards: Record<string, number> = {
  "first-roots": 40,
  "streak-three": 25,
  "streak-ten": 50,
  "actions-ten": 30,
  "actions-thirty": 60,
  "actions-hundred": 120,
  "first-success": 60,
  "three-successes": 120,
  "four-species": 50,
  "long-path": 90,
  "garden-decorator": 50,
  // Previous manually claimed achievements remain valid and keep their original value.
  "three-today": 30,
  "whole-garden": 70,
};
const dailyAchievementRewards: Record<string, number> = { one: 5, three: 20, five: 35 };
const legacyClaimedAchievementIds = new Set(["first-roots", "streak-ten", "three-today", "whole-garden"]);
const purchasePrices: Record<string, number> = {
  "species:peony": 160,
  "species:sakura": 230,
  "decoration:sign": 40,
  "decoration:lantern": 60,
  "decoration:stones": 75,
  "care:fertilizer": 25,
};
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dailyAchievementPattern = /^daily:(one|three|five):(\d{4}-\d{2}-\d{2})$/;

function cleanText(value: unknown, limit: number) {
  return String(value ?? "").trim().slice(0, limit);
}

function cleanDate(value: unknown) {
  const date = cleanText(value, 10);
  return datePattern.test(date) ? date : null;
}

function cleanIso(value: unknown) {
  const candidate = cleanText(value, 30);
  return Number.isFinite(Date.parse(candidate)) ? candidate : new Date(0).toISOString();
}

function cleanCompletionOverride(value: unknown): LivingCompletionOverride | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const date = cleanDate(input.date);
  if (!date || typeof input.completed !== "boolean") return null;
  return { date, completed: input.completed, updatedAt: cleanIso(input.updatedAt) };
}

function mergedCompletionOverrides(...groups: (LivingCompletionOverride[] | undefined)[]) {
  const overrides = new Map<string, LivingCompletionOverride>();
  for (const override of groups.flatMap((group) => group ?? [])) {
    const existing = overrides.get(override.date);
    if (!existing || existing.updatedAt.localeCompare(override.updatedAt) < 0 || (existing.updatedAt === override.updatedAt && !override.completed)) {
      overrides.set(override.date, override);
    }
  }
  return [...overrides.values()].sort((left, right) => left.date.localeCompare(right.date)).slice(-720);
}

function effectiveHabitDates(completionDates: string[], continuationDates: string[], overrides: LivingCompletionOverride[] = []) {
  const dates = new Set([...completionDates, ...continuationDates]);
  for (const override of overrides) {
    if (override.completed) dates.add(override.date);
    else dates.delete(override.date);
  }
  return [...dates].sort();
}

export function livingAchievementReward(id: string) {
  if (id in achievementRewards) return achievementRewards[id];
  const daily = dailyAchievementPattern.exec(id);
  return daily && datePattern.test(daily[2]) ? dailyAchievementRewards[daily[1]] ?? 0 : 0;
}

function cleanPlant(value: unknown): LivingPlantHabit | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const id = cleanText(input.id, 80);
  const habit = cleanText(input.habit, 100);
  const species = cleanText(input.species, 20) as LivingSpeciesCode;
  const frequency = cleanText(input.frequency, 20) as LivingFrequency;
  if (!id || !habit || !speciesCodes.has(species) || !frequencyCodes.has(frequency)) return null;
  const legacyCompletedDays = Number(input.completedDays);
  const baseCompletedDays = Math.min(30, Math.max(0, Math.floor(Number(input.baseCompletedDays) || (Number.isFinite(legacyCompletedDays) ? legacyCompletedDays : 0))));
  const completionDates = Array.isArray(input.completionDates)
    ? [...new Set(input.completionDates.map(cleanDate).filter((date): date is string => Boolean(date)))].sort().slice(0, Math.max(0, 30 - baseCompletedDays))
    : [];
  const goalDays = Math.min(360, Math.max(30, Math.floor(Number(input.goalDays) || 30)));
  const completionDateSet = new Set(completionDates);
  const continuationDates = Array.isArray(input.continuationDates)
    ? [...new Set(input.continuationDates.map(cleanDate).filter((date): date is string => Boolean(date) && !completionDateSet.has(date)))].sort().slice(0, Math.max(0, goalDays - 30))
    : [];
  const completionOverrides = Array.isArray(input.completionOverrides)
    ? mergedCompletionOverrides(input.completionOverrides.map(cleanCompletionOverride).filter((override): override is LivingCompletionOverride => Boolean(override)))
    : [];
  const reminder = input.reminder === null ? null : cleanText(input.reminder, 5) || null;
  const timesPerWeek = frequency === "customWeekly"
    ? Math.min(7, Math.max(1, Math.floor(Number(input.timesPerWeek) || 1)))
    : undefined;
  const updatedAt = cleanIso(input.updatedAt);
  const createdAt = input.createdAt
    ? cleanIso(input.createdAt)
    : completionDates[0]
      ? `${completionDates[0]}T00:00:00.000Z`
      : updatedAt;
  const effectiveDates = effectiveHabitDates(completionDates, continuationDates, completionOverrides);
  const habitDays = Math.min(goalDays, baseCompletedDays + effectiveDates.length);
  const isCompleted = habitDays >= goalDays;
  const completedAt = input.completedAt
    ? cleanIso(input.completedAt)
    : isCompleted
      ? effectiveDates.at(-1)
        ? `${effectiveDates.at(-1)}T00:00:00.000Z`
        : updatedAt
      : null;
  const sanitizedRewardedGoals = Array.isArray(input.rewardedGoals)
    ? [...new Set(input.rewardedGoals.map(Number).filter((goal) => Number.isInteger(goal) && goal >= 30 && goal <= habitDays))].sort((a, b) => a - b).slice(0, 12)
    : [];
  const rewardedGoals = isCompleted ? [...new Set([...sanitizedRewardedGoals, goalDays])].sort((a, b) => a - b) : sanitizedRewardedGoals;
  return { id, habit, species, baseCompletedDays, completionDates, continuationDates, completionOverrides, goalDays, rewardedGoals, frequency, timesPerWeek, reminder, createdAt, completedAt, updatedAt };
}

function cleanPurchase(value: unknown): LivingPurchase | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const id = cleanText(input.id, 80);
  const kind = cleanText(input.kind, 20) as LivingPurchase["kind"];
  const target = cleanText(input.target, 30);
  const expectedPrice = purchasePrices[`${kind}:${target}`];
  if (!id || !expectedPrice) return null;
  const plantId = kind === "decoration" ? cleanText(input.plantId, 80) : undefined;
  if (kind === "decoration" && !plantId) return null;
  return { id, kind, target, plantId, price: expectedPrice, createdAt: cleanIso(input.createdAt) };
}

export function sanitizeLivingGardenSnapshot(value: unknown): LivingGardenSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const deletedPlantIds = Array.isArray(input.deletedPlantIds)
    ? [...new Set(input.deletedPlantIds.map((id) => cleanText(id, 80)).filter(Boolean))].slice(0, 500)
    : [];
  const deletedPlantIdSet = new Set(deletedPlantIds);
  const plants = Array.isArray(input.plants) ? input.plants.map(cleanPlant).filter((plant): plant is LivingPlantHabit => Boolean(plant) && !deletedPlantIdSet.has(plant.id)).slice(0, 80) : [];
  if (!plants.length && input.version !== LIVING_GARDEN_VERSION) return null;
  const claimedAchievements = Array.isArray(input.claimedAchievements)
    ? [...new Set(input.claimedAchievements.map((id) => cleanText(id, 40)).filter((id) => legacyClaimedAchievementIds.has(id)))]
    : [];
  const purchases = Array.isArray(input.purchases) ? input.purchases.map(cleanPurchase).filter((purchase): purchase is LivingPurchase => Boolean(purchase)).slice(0, 500) : [];
  return { version: LIVING_GARDEN_VERSION, plants, claimedAchievements, purchases, deletedPlantIds };
}

export function completedDaysFor(plant: LivingPlantHabit) {
  return Math.min(30, plant.baseCompletedDays + livingHabitDates(plant).length);
}

export function habitDaysFor(plant: LivingPlantHabit) {
  return Math.min(plant.goalDays, plant.baseCompletedDays + livingHabitDates(plant).length);
}

export function livingHabitDates(plant: LivingPlantHabit) {
  return effectiveHabitDates(plant.completionDates, plant.continuationDates, plant.completionOverrides);
}

export function setLivingHabitDate(plant: LivingPlantHabit, date: string, completed: boolean, updatedAt: string) {
  if (!cleanDate(date)) return plant;
  const completionDates = plant.completionDates.filter((item) => item !== date);
  const continuationDates = plant.continuationDates.filter((item) => item !== date);
  if (completed) {
    if (completedDaysFor(plant) < 30) completionDates.push(date);
    else continuationDates.push(date);
  }
  const completionOverrides = mergedCompletionOverrides(
    plant.completionOverrides,
    [{ date, completed, updatedAt: cleanIso(updatedAt) }],
  );
  const draft = {
    ...plant,
    completionDates: [...new Set(completionDates)].sort(),
    continuationDates: [...new Set(continuationDates)].sort(),
    completionOverrides,
    updatedAt: cleanIso(updatedAt),
  };
  const nextHabitDays = habitDaysFor(draft);
  const retainedGoals = plant.rewardedGoals.filter((goal) => goal <= nextHabitDays);
  const rewardedGoals = completed && nextHabitDays >= plant.goalDays
    ? [...new Set([...retainedGoals, plant.goalDays])].sort((left, right) => left - right)
    : retainedGoals;
  return {
    ...draft,
    rewardedGoals,
    completedAt: rewardedGoals.length ? plant.completedAt ?? draft.updatedAt : null,
  };
}

function activityDateKeys(plants: LivingPlantHabit[]) {
  return [...new Set(plants.flatMap(livingHabitDates))].sort();
}

function previousDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function livingGardenActivityStreak(plants: LivingPlantHabit[], todayKey: string) {
  const dates = new Set(activityDateKeys(plants));
  let cursor = dates.has(todayKey) ? todayKey : previousDateKey(todayKey);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
}

export function livingGardenLongestActivityStreak(plants: LivingPlantHabit[]) {
  const dates = activityDateKeys(plants);
  let longest = 0;
  let current = 0;
  let previous: string | null = null;
  for (const date of dates) {
    current = previous && previousDateKey(date) === previous ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

export function livingGardenAchievementIds(snapshot: LivingGardenSnapshot) {
  const ids = new Set(snapshot.claimedAchievements.filter((id) => livingAchievementReward(id) > 0));
  const dateCounts = new Map<string, number>();
  for (const plant of snapshot.plants) {
    for (const date of livingHabitDates(plant)) dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
  }
  for (const [date, count] of dateCounts) {
    if (count >= 1) ids.add(`daily:one:${date}`);
    if (count >= 3) ids.add(`daily:three:${date}`);
    if (count >= 5) ids.add(`daily:five:${date}`);
  }

  const totalActions = [...dateCounts.values()].reduce((sum, count) => sum + count, 0);
  const longestStreak = livingGardenLongestActivityStreak(snapshot.plants);
  const successfulPlants = snapshot.plants.filter((plant) => plant.rewardedGoals.length > 0 || Boolean(plant.completedAt));
  if (snapshot.plants.some((plant) => completedDaysFor(plant) >= 20)) ids.add("first-roots");
  if (longestStreak >= 3) ids.add("streak-three");
  if (longestStreak >= 10) ids.add("streak-ten");
  if (totalActions >= 10) ids.add("actions-ten");
  if (totalActions >= 30) ids.add("actions-thirty");
  if (totalActions >= 100) ids.add("actions-hundred");
  if (successfulPlants.length >= 1) ids.add("first-success");
  if (successfulPlants.length >= 3) ids.add("three-successes");
  if (new Set(snapshot.plants.map((plant) => plant.species)).size >= 4) ids.add("four-species");
  if (snapshot.plants.some((plant) => plant.rewardedGoals.some((goal) => goal >= 60))) ids.add("long-path");
  if (new Set(snapshot.purchases.filter((purchase) => purchase.kind === "decoration").map((purchase) => purchase.plantId).filter(Boolean)).size >= 3) ids.add("garden-decorator");
  return [...ids].sort();
}

export function mergeLivingGardenSnapshots(left: LivingGardenSnapshot, right: LivingGardenSnapshot): LivingGardenSnapshot {
  const plants = new Map<string, LivingPlantHabit>();
  for (const plant of [...left.plants, ...right.plants]) {
    const existing = plants.get(plant.id);
    if (!existing) {
      plants.set(plant.id, plant);
      continue;
    }
    const latest = existing.updatedAt.localeCompare(plant.updatedAt) <= 0 ? plant : existing;
    const baseCompletedDays = Math.max(existing.baseCompletedDays, plant.baseCompletedDays);
    const goalDays = Math.max(existing.goalDays, plant.goalDays);
    const completionDates = [...new Set([...existing.completionDates, ...plant.completionDates])].sort().slice(0, Math.max(0, 30 - baseCompletedDays));
    const completionDateSet = new Set(completionDates);
    const continuationDates = [...new Set([...existing.continuationDates, ...plant.continuationDates])].filter((date) => !completionDateSet.has(date)).sort().slice(0, Math.max(0, goalDays - 30));
    const completionOverrides = mergedCompletionOverrides(existing.completionOverrides, plant.completionOverrides);
    const createdAt = existing.createdAt.localeCompare(plant.createdAt) <= 0 ? existing.createdAt : plant.createdAt;
    const completedAtCandidates = [existing.completedAt, plant.completedAt].filter((value): value is string => Boolean(value)).sort();
    const effectiveDates = effectiveHabitDates(completionDates, continuationDates, completionOverrides);
    const habitDays = Math.min(goalDays, baseCompletedDays + effectiveDates.length);
    const mergedRewardedGoals = [...new Set([...existing.rewardedGoals, ...plant.rewardedGoals])].filter((goal) => goal <= habitDays);
    const rewardedGoals = habitDays >= goalDays ? [...new Set([...mergedRewardedGoals, goalDays])].sort((a, b) => a - b) : mergedRewardedGoals.sort((a, b) => a - b);
    const completedAt = rewardedGoals.length
      ? completedAtCandidates[0] ?? (effectiveDates.at(-1) ? `${effectiveDates.at(-1)}T00:00:00.000Z` : latest.updatedAt)
      : null;
    plants.set(plant.id, { ...latest, baseCompletedDays, completionDates, continuationDates, completionOverrides, goalDays, rewardedGoals, createdAt, completedAt });
  }

  const deletedPlantIds = [...new Set([...(left.deletedPlantIds ?? []), ...(right.deletedPlantIds ?? [])])];
  const deletedPlantIdSet = new Set(deletedPlantIds);
  const purchases = new Map<string, LivingPurchase>();
  for (const purchase of [...left.purchases, ...right.purchases]) purchases.set(purchase.id, purchase);
  return {
    version: LIVING_GARDEN_VERSION,
    plants: [...plants.values()].filter((plant) => !deletedPlantIdSet.has(plant.id)),
    claimedAchievements: [...new Set([...left.claimedAchievements, ...right.claimedAchievements])],
    purchases: [...purchases.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    deletedPlantIds,
  };
}

export function livingGardenPoints(snapshot: LivingGardenSnapshot) {
  const completionStars = snapshot.plants.reduce((sum, plant) => sum + livingHabitDates(plant).length * 10, 0);
  const completedPlantStars = snapshot.plants.reduce((sum, plant) => sum + plant.rewardedGoals.length * LIVING_COMPLETION_REWARD, 0);
  const achievementStars = livingGardenAchievementIds(snapshot).reduce((sum, id) => sum + livingAchievementReward(id), 0);
  const spentStars = snapshot.purchases.reduce((sum, purchase) => sum + purchase.price, 0);
  return Math.max(0, 120 + completionStars + completedPlantStars + achievementStars - spentStars);
}

export function unlockedLivingSpecies(snapshot: LivingGardenSnapshot): LivingSpeciesCode[] {
  const unlocked = new Set<LivingSpeciesCode>(["sunflower", "tomato", "lavender", "monstera", "oak", "apple"]);
  for (const purchase of snapshot.purchases) if (purchase.kind === "species" && speciesCodes.has(purchase.target as LivingSpeciesCode)) unlocked.add(purchase.target as LivingSpeciesCode);
  return [...unlocked];
}

export function livingDecorations(snapshot: LivingGardenSnapshot): Record<string, LivingDecorationCode> {
  const result: Record<string, LivingDecorationCode> = {};
  for (const purchase of snapshot.purchases) {
    if (purchase.kind === "decoration" && purchase.plantId && ["sign", "lantern", "stones"].includes(purchase.target)) {
      result[purchase.plantId] = purchase.target as LivingDecorationCode;
    }
  }
  return result;
}

export function livingDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
