import {
  addDays,
  defaultPlantForHabit,
  evaluateHabit,
  makeSeason,
  stableGardenSlot,
  type DateKey,
  type DomainHabit,
  type HabitMetrics,
  type HabitStatus,
  type PlantKind,
  type ScheduleRule,
} from "./domain.ts";

export const DATA_VERSION = 2;
export const STORAGE_KEY = "rost-habits-v2";
export const LEGACY_STORAGE_KEY = "rost-habits-v1";
export const BACKUP_STORAGE_KEY = "rost-habits-v1-backup";

export type StoredHabit = {
  schemaVersion: 2;
  id: string;
  name: string;
  icon: string;
  color: string;
  completions: DateKey[];
  plantKind: PlantKind;
  gardenSlot: number;
  gardenPosition?: { x: number; z: number };
  startsOn: DateKey;
  endsOn: DateKey;
  schedule: ScheduleRule;
  status: HabitStatus;
  seasonNumber: number;
  reminder: { enabled: boolean; time: string; timezone: string };
  createdAt: string;
  updatedAt: string;
};

export type LegacyHabit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  completions: string[];
};

export type NewHabitInput = {
  name: string;
  icon: string;
  color: string;
  startsOn: DateKey;
  endsOn: DateKey;
  schedule: ScheduleRule;
  plantKind: PlantKind;
  reminder: { enabled: boolean; time: string; timezone: string };
};

export function isStoredHabit(value: unknown): value is StoredHabit {
  return Boolean(value && typeof value === "object" && (value as StoredHabit).schemaVersion === DATA_VERSION);
}

export function migrateLegacyHabits(items: LegacyHabit[], today: DateKey): StoredHabit[] {
  const occupied = new Set<number>();
  return items.map((item) => ({
    schemaVersion: DATA_VERSION,
    id: item.id,
    name: item.name,
    icon: item.icon,
    color: item.color,
    completions: [...new Set(item.completions)].sort() as DateKey[],
    plantKind: defaultPlantForHabit(item.name),
    gardenSlot: stableGardenSlot(item.id, occupied),
    startsOn: today,
    endsOn: addDays(today, 29),
    schedule: { type: "daily" },
    status: "active",
    seasonNumber: 1,
    reminder: { enabled: false, time: "09:00", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export function createStoredHabit(input: NewHabitInput, id = crypto.randomUUID(), occupied = new Set<number>()): StoredHabit {
  const now = new Date().toISOString();
  return {
    schemaVersion: DATA_VERSION,
    id,
    name: input.name.trim(),
    icon: input.icon,
    color: input.color,
    completions: [],
    plantKind: input.plantKind,
    gardenSlot: stableGardenSlot(id, occupied),
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    schedule: input.schedule,
    status: "active",
    seasonNumber: 1,
    reminder: input.reminder,
    createdAt: now,
    updatedAt: now,
  };
}

export function toDomainHabit(habit: StoredHabit): DomainHabit {
  const season = makeSeason(habit.startsOn, 1, habit.schedule, `${habit.id}-season-${habit.seasonNumber}`);
  season.endsOn = habit.endsOn;
  season.number = habit.seasonNumber;
  season.status = habit.status;
  return {
    id: habit.id,
    name: habit.name,
    icon: habit.icon,
    color: habit.color,
    plantKind: habit.plantKind,
    status: habit.status,
    season,
    completions: habit.completions.map((localDate) => ({
      id: `${habit.id}-${localDate}`,
      habitId: habit.id,
      seasonId: season.id,
      localDate,
      operationId: `local:${habit.id}:${localDate}`,
      createdAt: `${localDate}T12:00:00.000Z`,
    })),
    reminder: habit.reminder,
    createdAt: habit.createdAt,
    updatedAt: habit.updatedAt,
  };
}

export function metricsForHabit(habit: StoredHabit, today: DateKey): HabitMetrics {
  return evaluateHabit(toDomainHabit(habit), today);
}
