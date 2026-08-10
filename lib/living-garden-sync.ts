export const LIVING_GARDEN_STORAGE_KEY = "rost-living-garden-v1";
export const LIVING_GARDEN_VERSION = 1;
export const LIVING_COMPLETION_REWARD = 60;

export type LivingSpeciesCode = "sunflower" | "tomato" | "lavender" | "monstera" | "oak" | "apple" | "peony" | "sakura";
export type LivingFrequency = "daily" | "weekly" | "threeWeekly";
export type LivingDecorationCode = "sign" | "lantern" | "stones";

export type LivingPlantHabit = {
  id: string;
  habit: string;
  species: LivingSpeciesCode;
  baseCompletedDays: number;
  completionDates: string[];
  continuationDates: string[];
  goalDays: number;
  rewardedGoals: number[];
  frequency: LivingFrequency;
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
};

const speciesCodes = new Set<LivingSpeciesCode>(["sunflower", "tomato", "lavender", "monstera", "oak", "apple", "peony", "sakura"]);
const frequencyCodes = new Set<LivingFrequency>(["daily", "weekly", "threeWeekly"]);
const achievementRewards: Record<string, number> = { "first-roots": 40, "streak-ten": 50, "three-today": 30, "whole-garden": 70 };
const purchasePrices: Record<string, number> = {
  "species:peony": 160,
  "species:sakura": 230,
  "decoration:sign": 40,
  "decoration:lantern": 60,
  "decoration:stones": 75,
  "care:fertilizer": 25,
};
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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
  const reminder = input.reminder === null ? null : cleanText(input.reminder, 5) || null;
  const updatedAt = cleanIso(input.updatedAt);
  const createdAt = input.createdAt
    ? cleanIso(input.createdAt)
    : completionDates[0]
      ? `${completionDates[0]}T00:00:00.000Z`
      : updatedAt;
  const habitDays = Math.min(goalDays, baseCompletedDays + completionDates.length + continuationDates.length);
  const isCompleted = habitDays >= goalDays;
  const completedAt = input.completedAt
    ? cleanIso(input.completedAt)
    : isCompleted
      ? [...completionDates, ...continuationDates].sort().at(-1)
        ? `${[...completionDates, ...continuationDates].sort().at(-1)}T00:00:00.000Z`
        : updatedAt
      : null;
  const sanitizedRewardedGoals = Array.isArray(input.rewardedGoals)
    ? [...new Set(input.rewardedGoals.map(Number).filter((goal) => Number.isInteger(goal) && goal >= 30 && goal <= habitDays))].sort((a, b) => a - b).slice(0, 12)
    : [];
  const rewardedGoals = isCompleted ? [...new Set([...sanitizedRewardedGoals, goalDays])].sort((a, b) => a - b) : sanitizedRewardedGoals;
  return { id, habit, species, baseCompletedDays, completionDates, continuationDates, goalDays, rewardedGoals, frequency, reminder, createdAt, completedAt, updatedAt };
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
  const plants = Array.isArray(input.plants) ? input.plants.map(cleanPlant).filter((plant): plant is LivingPlantHabit => Boolean(plant)).slice(0, 80) : [];
  if (!plants.length && input.version !== LIVING_GARDEN_VERSION) return null;
  const claimedAchievements = Array.isArray(input.claimedAchievements)
    ? [...new Set(input.claimedAchievements.map((id) => cleanText(id, 40)).filter((id) => id in achievementRewards))]
    : [];
  const purchases = Array.isArray(input.purchases) ? input.purchases.map(cleanPurchase).filter((purchase): purchase is LivingPurchase => Boolean(purchase)).slice(0, 500) : [];
  return { version: LIVING_GARDEN_VERSION, plants, claimedAchievements, purchases };
}

export function completedDaysFor(plant: LivingPlantHabit) {
  return Math.min(30, plant.baseCompletedDays + plant.completionDates.length);
}

export function habitDaysFor(plant: LivingPlantHabit) {
  return Math.min(plant.goalDays, plant.baseCompletedDays + plant.completionDates.length + plant.continuationDates.length);
}

export function livingHabitDates(plant: LivingPlantHabit) {
  return [...new Set([...plant.completionDates, ...plant.continuationDates])].sort();
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
    const createdAt = existing.createdAt.localeCompare(plant.createdAt) <= 0 ? existing.createdAt : plant.createdAt;
    const completedAtCandidates = [existing.completedAt, plant.completedAt].filter((value): value is string => Boolean(value)).sort();
    const habitDays = Math.min(goalDays, baseCompletedDays + completionDates.length + continuationDates.length);
    const completedAt = completedAtCandidates[0] ?? (habitDays >= goalDays ? ([...completionDates, ...continuationDates].sort().at(-1) ? `${[...completionDates, ...continuationDates].sort().at(-1)}T00:00:00.000Z` : latest.updatedAt) : null);
    const mergedRewardedGoals = [...new Set([...existing.rewardedGoals, ...plant.rewardedGoals])].filter((goal) => goal <= habitDays);
    const rewardedGoals = habitDays >= goalDays ? [...new Set([...mergedRewardedGoals, goalDays])].sort((a, b) => a - b) : mergedRewardedGoals.sort((a, b) => a - b);
    plants.set(plant.id, { ...latest, baseCompletedDays, completionDates, continuationDates, goalDays, rewardedGoals, createdAt, completedAt });
  }

  const purchases = new Map<string, LivingPurchase>();
  for (const purchase of [...left.purchases, ...right.purchases]) purchases.set(purchase.id, purchase);
  return {
    version: LIVING_GARDEN_VERSION,
    plants: [...plants.values()],
    claimedAchievements: [...new Set([...left.claimedAchievements, ...right.claimedAchievements])],
    purchases: [...purchases.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export function livingGardenPoints(snapshot: LivingGardenSnapshot) {
  const completionStars = snapshot.plants.reduce((sum, plant) => sum + (plant.completionDates.length + plant.continuationDates.length) * 10, 0);
  const completedPlantStars = snapshot.plants.reduce((sum, plant) => sum + plant.rewardedGoals.length * LIVING_COMPLETION_REWARD, 0);
  const achievementStars = snapshot.claimedAchievements.reduce((sum, id) => sum + (achievementRewards[id] ?? 0), 0);
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
