import type { LivingFrequency, LivingPlantHabit } from "./living-garden-sync";

export type MonthlyPlantStatistic = {
  plantId: string;
  completed: number;
  target: number;
  missed: number;
  rate: number;
  dates: string[];
};

export type MonthlyGardenStatistic = {
  monthKey: string;
  daysInMonth: number;
  elapsedDays: number;
  calendarOffset: number;
  totalCompleted: number;
  activeDays: number;
  target: number;
  missed: number;
  rate: number;
  days: Array<{ day: number; dateKey: string; completed: number; isFuture: boolean; isToday: boolean }>;
  weeks: Array<{ label: string; completed: number }>;
  plants: MonthlyPlantStatistic[];
};

function monthParts(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error("Invalid month key");
  return { year: Number(match[1]), month: Number(match[2]) };
}

function scheduleTarget(frequency: LivingFrequency, elapsedDays: number) {
  if (elapsedDays <= 0) return 0;
  if (frequency === "daily") return elapsedDays;
  if (frequency === "threeWeekly") return Math.ceil(elapsedDays * 3 / 7);
  return Math.ceil(elapsedDays / 7);
}

export function livingMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function moveLivingMonth(monthKey: string, offset: number) {
  const { year, month } = monthParts(monthKey);
  const moved = new Date(year, month - 1 + offset, 1);
  return livingMonthKey(moved);
}

export function livingMonthLabel(monthKey: string) {
  const { year, month } = monthParts(monthKey);
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildMonthlyGardenStatistic(plants: LivingPlantHabit[], monthKey: string, todayKey: string): MonthlyGardenStatistic {
  const { year, month } = monthParts(monthKey);
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentMonth = todayKey.slice(0, 7);
  const elapsedDays = monthKey < currentMonth ? daysInMonth : monthKey > currentMonth ? 0 : Math.min(daysInMonth, Number(todayKey.slice(8, 10)) || 0);
  const monthStart = `${monthKey}-01`;
  const dayCounts = new Map<string, number>();

  const plantStatistics = plants.map((plant): MonthlyPlantStatistic => {
    const dates = plant.completionDates.filter((date) => date.startsWith(`${monthKey}-`)).sort();
    for (const date of dates) dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
    const completedBeforeMonth = plant.completionDates.filter((date) => date < monthStart).length;
    const remainingAtStart = Math.max(0, 30 - plant.baseCompletedDays - completedBeforeMonth);
    const trackingStarted = plant.createdAt.slice(0, 10);
    const eligibleDays = trackingStarted > `${monthKey}-${String(elapsedDays).padStart(2, "0")}`
      ? 0
      : trackingStarted < monthStart
        ? elapsedDays
        : Math.max(0, elapsedDays - Number(trackingStarted.slice(8, 10)) + 1);
    const target = Math.min(remainingAtStart, scheduleTarget(plant.frequency, eligibleDays));
    const completed = dates.length;
    const missed = Math.max(0, target - completed);
    const rate = target > 0 ? Math.min(100, Math.round(completed / target * 100)) : completed > 0 ? 100 : 0;
    return { plantId: plant.id, completed, target, missed, rate, dates };
  });

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
    return { day, dateKey, completed: dayCounts.get(dateKey) ?? 0, isFuture: dateKey > todayKey, isToday: dateKey === todayKey };
  });
  const weeks = Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, index) => {
    const start = index * 7 + 1;
    const end = Math.min(daysInMonth, start + 6);
    return {
      label: `${start}–${end}`,
      completed: days.slice(start - 1, end).reduce((sum, day) => sum + day.completed, 0),
    };
  });
  const totalCompleted = plantStatistics.reduce((sum, item) => sum + item.completed, 0);
  const target = plantStatistics.reduce((sum, item) => sum + item.target, 0);
  const missed = plantStatistics.reduce((sum, item) => sum + item.missed, 0);
  return {
    monthKey,
    daysInMonth,
    elapsedDays,
    calendarOffset: (new Date(year, month - 1, 1).getDay() + 6) % 7,
    totalCompleted,
    activeDays: dayCounts.size,
    target,
    missed,
    rate: target > 0 ? Math.min(100, Math.round(totalCompleted / target * 100)) : totalCompleted > 0 ? 100 : 0,
    days,
    weeks,
    plants: plantStatistics,
  };
}
