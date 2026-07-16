export type DateKey = `${number}-${number}-${number}`;

export type HabitStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "ended_early"
  | "archived"
  | "deleted";

export type PlantKind =
  | "oak"
  | "cherry"
  | "birch"
  | "willow"
  | "lavender"
  | "chamomile"
  | "sunflower"
  | "peony"
  | "fern"
  | "hydrangea"
  | "rosemary"
  | "strawberry";

export type ScheduleRule =
  | { type: "daily" }
  | { type: "weekdays"; weekdays: number[] }
  | { type: "weekly"; times: number };

export type ScheduleVersion = {
  id: string;
  effectiveFrom: DateKey;
  effectiveTo?: DateKey;
  rule: ScheduleRule;
};

export type HabitSeason = {
  id: string;
  number: number;
  startsOn: DateKey;
  endsOn: DateKey;
  scheduleVersions: ScheduleVersion[];
  status: HabitStatus;
};

export type Completion = {
  id: string;
  habitId: string;
  seasonId: string;
  localDate: DateKey;
  operationId: string;
  createdAt: string;
  deletedAt?: string;
};

export type DomainHabit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  plantKind: PlantKind;
  status: HabitStatus;
  season: HabitSeason;
  completions: Completion[];
  reminder?: { enabled: boolean; time: string; timezone: string };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type HabitMetrics = {
  planned: number;
  completed: number;
  missed: number;
  progress: number;
  health: number;
  currentStreak: number;
  bestStreak: number;
  consecutiveMisses: number;
};

export type RewardEvent = {
  operationId: string;
  code: string;
  stars: number;
};

const DAY_MS = 86_400_000;

export function parseDateKey(value: DateKey): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function toDateKey(date: Date): DateKey {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}` as DateKey;
}

export function addDays(value: DateKey, amount: number): DateKey {
  const date = parseDateKey(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDateKey(date);
}

export function compareDate(a: DateKey, b: DateKey) {
  return a.localeCompare(b);
}

export function isoWeekday(value: DateKey) {
  const day = parseDateKey(value).getUTCDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(value: DateKey): DateKey {
  return addDays(value, 1 - isoWeekday(value));
}

export function endOfWeek(value: DateKey): DateKey {
  return addDays(startOfWeek(value), 6);
}

export function datesBetween(start: DateKey, end: DateKey): DateKey[] {
  if (compareDate(start, end) > 0) return [];
  const days = Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / DAY_MS);
  return Array.from({ length: days + 1 }, (_, index) => addDays(start, index));
}

export function scheduleForDate(versions: ScheduleVersion[], date: DateKey) {
  return [...versions]
    .filter((version) => compareDate(version.effectiveFrom, date) <= 0 && (!version.effectiveTo || compareDate(date, version.effectiveTo) <= 0))
    .sort((a, b) => compareDate(b.effectiveFrom, a.effectiveFrom))[0];
}

export function isFixedDateScheduled(versions: ScheduleVersion[], date: DateKey) {
  const rule = scheduleForDate(versions, date)?.rule;
  if (!rule) return false;
  if (rule.type === "daily") return true;
  if (rule.type === "weekdays") return rule.weekdays.includes(isoWeekday(date));
  return false;
}

type EvaluationUnit = { key: string; dueOn: DateKey; completed: boolean; closed: boolean };

function activeCompletions(habit: DomainHabit) {
  const seen = new Set<string>();
  return habit.completions
    .filter((completion) => !completion.deletedAt && !seen.has(completion.localDate) && seen.add(completion.localDate))
    .sort((a, b) => compareDate(a.localDate, b.localDate));
}

function evaluationUnits(habit: DomainHabit, today: DateKey): EvaluationUnit[] {
  const { season } = habit;
  const completionDates = new Set(activeCompletions(habit).map((item) => item.localDate));
  const fixed: EvaluationUnit[] = [];
  const weeklyDates = new Map<string, DateKey[]>();

  for (const date of datesBetween(season.startsOn, season.endsOn)) {
    const rule = scheduleForDate(season.scheduleVersions, date)?.rule;
    if (!rule) continue;
    if (rule.type === "weekly") {
      const week = startOfWeek(date);
      const dates = weeklyDates.get(week) ?? [];
      dates.push(date);
      weeklyDates.set(week, dates);
      continue;
    }
    if (rule.type === "daily" || rule.weekdays.includes(isoWeekday(date))) {
      fixed.push({ key: date, dueOn: date, completed: completionDates.has(date), closed: compareDate(date, today) < 0 });
    }
  }

  const weekly: EvaluationUnit[] = [];
  for (const [week, dates] of weeklyDates) {
    const version = scheduleForDate(season.scheduleVersions, dates[0]);
    if (!version || version.rule.type !== "weekly") continue;
    const required = Math.min(version.rule.times, dates.length);
    const completions = activeCompletions(habit).filter((item) => dates.includes(item.localDate)).length;
    const dueOn = dates.at(-1)!;
    const closed = compareDate(endOfWeek(week as DateKey), today) < 0 || compareDate(season.endsOn, today) < 0;
    for (let slot = 0; slot < required; slot += 1) {
      weekly.push({ key: `${week}#${slot + 1}`, dueOn, completed: slot < completions, closed });
    }
  }

  return [...fixed, ...weekly].sort((a, b) => compareDate(a.dueOn, b.dueOn) || a.key.localeCompare(b.key));
}

export function evaluateHabit(habit: DomainHabit, today: DateKey): HabitMetrics {
  const units = evaluationUnits(habit, today);
  const completed = units.filter((unit) => unit.completed).length;
  const missed = units.filter((unit) => unit.closed && !unit.completed).length;
  const sequence = units.filter((unit) => unit.closed || unit.completed);
  let currentStreak = 0;
  let bestStreak = 0;
  let running = 0;
  let consecutiveMisses = 0;

  for (const unit of sequence) {
    if (unit.completed) {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
      consecutiveMisses = 0;
    } else {
      running = 0;
      consecutiveMisses += 1;
    }
  }
  currentStreak = running;

  const protectedStatus = ["paused", "completed", "ended_early", "archived"].includes(habit.status);
  const health = protectedStatus ? 100 : Math.max(25, 100 - Math.max(0, consecutiveMisses - 1) * 18);

  return {
    planned: units.length,
    completed,
    missed,
    progress: units.length ? Math.min(1, completed / units.length) : 0,
    health,
    currentStreak,
    bestStreak,
    consecutiveMisses,
  };
}

export function canEditCompletion(target: DateKey, today: DateKey, daysBack = 3) {
  return compareDate(target, today) <= 0 && compareDate(target, addDays(today, -daysBack)) >= 0;
}

export function dedupeRewardEvents(events: RewardEvent[]) {
  const operationIds = new Set<string>();
  return events.filter((event) => {
    if (operationIds.has(event.operationId)) return false;
    operationIds.add(event.operationId);
    return true;
  });
}

export function starBalance(events: RewardEvent[]) {
  return dedupeRewardEvents(events).reduce((sum, event) => sum + event.stars, 0);
}

export function stableGardenSlot(id: string, occupied = new Set<number>(), slots = 64) {
  let hash = 2166136261;
  for (const character of id) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  let slot = (hash >>> 0) % slots;
  while (occupied.has(slot)) slot = (slot + 1) % slots;
  occupied.add(slot);
  return slot;
}

export function defaultPlantForHabit(name: string): PlantKind {
  const value = name.toLocaleLowerCase("ru-RU");
  if (/вод|пить/.test(value)) return "willow";
  if (/спорт|ход|бег|растяж|йог/.test(value)) return "birch";
  if (/чита|уч|язык|книг/.test(value)) return "oak";
  if (/сон|медит|дых/.test(value)) return "lavender";
  if (/еда|витамин|ягод/.test(value)) return "strawberry";
  return "chamomile";
}

export function makeSeason(start: DateKey, durationDays: number, rule: ScheduleRule, id = crypto.randomUUID()): HabitSeason {
  return {
    id,
    number: 1,
    startsOn: start,
    endsOn: addDays(start, Math.max(1, durationDays) - 1),
    status: "active",
    scheduleVersions: [{ id: `${id}-schedule-1`, effectiveFrom: start, rule }],
  };
}

