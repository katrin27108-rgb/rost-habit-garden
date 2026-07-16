"use client";

import { useMemo, useState } from "react";
import { addDays, evaluateHabitRange, type DateKey } from "../lib/domain";
import { toDomainHabit, type StoredHabit } from "../lib/app-model";

export default function StatsPanel({ habits, today }: { habits: StoredHabit[]; today: DateKey }) {
  const [days, setDays] = useState<7 | 30>(7);
  const [habitId, setHabitId] = useState("all");
  const filtered = habitId === "all" ? habits : habits.filter((habit) => habit.id === habitId);
  const from = addDays(today, -(days - 1));
  const data = useMemo(() => {
    const metrics = filtered.map((habit) => evaluateHabitRange(toDomainHabit(habit), from, today, today));
    const planned = metrics.reduce((sum, item) => sum + item.planned, 0);
    const completed = metrics.reduce((sum, item) => sum + item.completed, 0);
    const missed = metrics.reduce((sum, item) => sum + item.missed, 0);
    const series = metrics.reduce((best, item) => Math.max(best, item.currentStreak), 0);
    const chart = Array.from({ length: days }, (_, index) => {
      const date = addDays(from, index);
      return { date, count: filtered.filter((habit) => habit.completions.includes(date)).length };
    });
    return { planned, completed, missed, series, percent: planned ? Math.round(completed / planned * 100) : 0, chart };
  }, [days, filtered, from, today]);

  return <section className="panel stats-panel" aria-labelledby="stats-title">
    <div className="section-heading compact"><div><p className="eyebrow">Динамика</p><h2 id="stats-title">Статистика</h2></div><div className="range-toggle"><button className={days === 7 ? "active" : ""} onClick={() => setDays(7)}>7 дней</button><button className={days === 30 ? "active" : ""} onClick={() => setDays(30)}>30 дней</button></div></div>
    <select value={habitId} onChange={(event) => setHabitId(event.target.value)} aria-label="Фильтр привычки"><option value="all">Все растения</option>{habits.map((habit) => <option value={habit.id} key={habit.id}>{habit.name}</option>)}</select>
    <div className="stats-bars" aria-label={`Выполнено ${data.percent}%`}>{data.chart.map((item) => <i key={item.date} style={{ height: `${Math.max(5, filtered.length ? item.count / filtered.length * 100 : 5)}%` }} title={`${item.date}: ${item.count}`} />)}</div>
    <div className="stats-numbers"><div><span>Выполнено</span><b>{data.completed}</b></div><div><span>Пропущено</span><b>{data.missed}</b></div><div><span>Ритм</span><b>{data.series}</b></div><div><span>Процент</span><b>{data.percent}%</b></div></div>
  </section>;
}

