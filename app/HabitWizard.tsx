"use client";

import { useMemo, useState } from "react";
import { addDays, defaultPlantForHabit, datesBetween, isoWeekday, type DateKey, type PlantKind, type ScheduleRule } from "../lib/domain";
import type { NewHabitInput } from "../lib/app-model";

const ICONS = ["💧", "🧘", "📖", "🚶", "🌿", "☀️", "✍️", "🥗"];
const COLORS = ["#dff08c", "#f6a789", "#b9d8cf", "#c7b8eb", "#f4d579"];
const DURATIONS = [7, 14, 21, 30, 60, 90];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const PLANTS: Array<{ id: PlantKind; name: string; icon: string }> = [
  { id: "oak", name: "Дуб", icon: "🌳" }, { id: "cherry", name: "Вишня", icon: "🌸" },
  { id: "birch", name: "Берёза", icon: "🌲" }, { id: "willow", name: "Ива", icon: "🌿" },
  { id: "lavender", name: "Лаванда", icon: "🪻" }, { id: "chamomile", name: "Ромашка", icon: "🌼" },
  { id: "sunflower", name: "Подсолнух", icon: "🌻" }, { id: "peony", name: "Пион", icon: "🌺" },
  { id: "fern", name: "Папоротник", icon: "🌿" }, { id: "hydrangea", name: "Гортензия", icon: "💠" },
  { id: "rosemary", name: "Розмарин", icon: "🌱" }, { id: "strawberry", name: "Земляника", icon: "🍓" },
];

function todayKey(): DateKey {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` as DateKey;
}

function countPlan(start: DateKey, end: DateKey, schedule: ScheduleRule) {
  const dates = datesBetween(start, end);
  if (schedule.type === "daily") return dates.length;
  if (schedule.type === "weekdays") return dates.filter((date) => schedule.weekdays.includes(isoWeekday(date))).length;
  const weeks = new Map<string, number>();
  for (const date of dates) {
    const monday = addDays(date, 1 - isoWeekday(date));
    weeks.set(monday, (weeks.get(monday) ?? 0) + 1);
  }
  return [...weeks.values()].reduce((sum, days) => sum + Math.min(days, schedule.times), 0);
}

export default function HabitWizard({ onClose, onCreate }: { onClose: () => void; onCreate: (input: NewHabitInput) => void }) {
  const start = todayKey();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [duration, setDuration] = useState(30);
  const [customEnd, setCustomEnd] = useState(addDays(start, 29));
  const [scheduleType, setScheduleType] = useState<ScheduleRule["type"]>("daily");
  const [weekdays, setWeekdays] = useState([1, 3, 5]);
  const [times, setTimes] = useState(3);
  const suggestedPlant = defaultPlantForHabit(name);
  const [plant, setPlant] = useState<PlantKind | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const end = duration === 0 ? customEnd : addDays(start, duration - 1);
  const schedule: ScheduleRule = scheduleType === "daily" ? { type: "daily" } : scheduleType === "weekdays" ? { type: "weekdays", weekdays } : { type: "weekly", times };
  const planned = useMemo(() => countPlan(start, end, schedule), [end, scheduleType, times, weekdays]);
  const selectedPlant = plant ?? suggestedPlant;
  const plantInfo = PLANTS.find((item) => item.id === selectedPlant)!;
  const canContinue = step !== 1 || name.trim().length > 0;

  const finish = () => onCreate({
    name, icon, color, startsOn: start, endsOn: end, schedule, plantKind: selectedPlant,
    reminder: { enabled: reminderEnabled, time: reminderTime, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
  });

  return <div className="modal-backdrop" role="presentation"><section className="habit-modal wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <button className="modal-close" type="button" onClick={onClose} aria-label="Закрыть">×</button>
    <div className="wizard-progress" aria-label={`Шаг ${step} из 6`}>{Array.from({ length: 6 }, (_, index) => <i className={index < step ? "active" : ""} key={index} />)}</div>
    <p className="eyebrow">Новое семечко · шаг {step} из 6</p>

    {step === 1 && <><h2 id="wizard-title">Что хочешь вырастить?</h2><label className="field-label" htmlFor="habit-name">Название привычки</label><input id="habit-name" autoFocus maxLength={60} placeholder="Например, медитировать 5 минут" value={name} onChange={(event) => setName(event.target.value)} /><span className="field-label">Символ</span><div className="choice-row">{ICONS.map((value) => <button type="button" className={icon === value ? "selected" : ""} onClick={() => setIcon(value)} key={value}>{value}</button>)}</div><span className="field-label">Цвет</span><div className="color-row">{COLORS.map((value) => <button type="button" className={color === value ? "selected" : ""} style={{ background: value }} onClick={() => setColor(value)} key={value} />)}</div></>}
    {step === 2 && <><h2 id="wizard-title">Как долго растём?</h2><p className="wizard-copy">Срок задаёт плавный путь от семечка до взрослого растения.</p><div className="duration-grid">{DURATIONS.map((value) => <button type="button" className={duration === value ? "selected" : ""} onClick={() => setDuration(value)} key={value}><b>{value}</b><span>дней</span></button>)}<button type="button" className={duration === 0 ? "selected" : ""} onClick={() => setDuration(0)}><b>···</b><span>своя дата</span></button></div>{duration === 0 && <><label className="field-label" htmlFor="custom-end">Дата окончания</label><input id="custom-end" type="date" min={start} value={customEnd} onChange={(event) => setCustomEnd(event.target.value as DateKey)} /></>}</>}
    {step === 3 && <><h2 id="wizard-title">Выбери ритм</h2><div className="schedule-types"><button type="button" className={scheduleType === "daily" ? "selected" : ""} onClick={() => setScheduleType("daily")}><b>Каждый день</b><span>Спокойный ежедневный ритм</span></button><button type="button" className={scheduleType === "weekdays" ? "selected" : ""} onClick={() => setScheduleType("weekdays")}><b>По дням недели</b><span>Только выбранные дни</span></button><button type="button" className={scheduleType === "weekly" ? "selected" : ""} onClick={() => setScheduleType("weekly")}><b>Несколько раз в неделю</b><span>В любые удобные дни</span></button></div>{scheduleType === "weekdays" && <div className="weekday-row">{WEEKDAYS.map((day, index) => <button type="button" className={weekdays.includes(index + 1) ? "selected" : ""} onClick={() => setWeekdays((current) => current.includes(index + 1) ? current.filter((value) => value !== index + 1) : [...current, index + 1])} key={day}>{day}</button>)}</div>}{scheduleType === "weekly" && <div className="times-picker"><span>Сколько раз?</span>{[1,2,3,4,5,6,7].map((value) => <button type="button" className={times === value ? "selected" : ""} onClick={() => setTimes(value)} key={value}>{value}</button>)}</div>}<div className="plan-note">За выбранный срок запланировано <strong>{planned} действий</strong>.</div></>}
    {step === 4 && <><h2 id="wizard-title">Выбери растение</h2><p className="wizard-copy">Мы предлагаем {PLANTS.find((item) => item.id === suggestedPlant)?.name.toLowerCase()}, но выбор всегда за тобой.</p><div className="plant-grid">{PLANTS.map((item) => <button type="button" className={selectedPlant === item.id ? "selected" : ""} onClick={() => setPlant(item.id)} key={item.id}><span>{item.icon}</span><b>{item.name}</b></button>)}</div></>}
    {step === 5 && <><h2 id="wizard-title">Напомнить бережно?</h2><label className="reminder-toggle"><input type="checkbox" checked={reminderEnabled} onChange={(event) => setReminderEnabled(event.target.checked)} /><span><b>Включить напоминание</b><small>Сначала оно будет появляться внутри приложения</small></span></label>{reminderEnabled && <><label className="field-label" htmlFor="reminder-time">Время</label><input id="reminder-time" type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /></>}</>}
    {step === 6 && <><h2 id="wizard-title">Всё готово к посадке</h2><div className="wizard-summary"><div className="summary-plant"><span>{plantInfo.icon}</span><div><b>{name}</b><small>{plantInfo.name} · сезон 1</small></div></div><dl><div><dt>Срок</dt><dd>{start} — {end}</dd></div><div><dt>План</dt><dd>{planned} действий</dd></div><div><dt>Напоминание</dt><dd>{reminderEnabled ? `в ${reminderTime}` : "выключено"}</dd></div></dl><p>Каждая отметка будет плавно выращивать только это растение. Пропуски не отнимут уже пройденный рост.</p></div></>}

    <div className="wizard-actions">{step > 1 && <button type="button" className="wizard-back" onClick={() => setStep((value) => value - 1)}>← Назад</button>}<button className="modal-submit" type="button" disabled={!canContinue || (step === 3 && scheduleType === "weekdays" && weekdays.length === 0)} onClick={() => step === 6 ? finish() : setStep((value) => value + 1)}>{step === 6 ? "Посадить привычку" : "Продолжить"} <span>→</span></button></div>
  </section></div>;
}

