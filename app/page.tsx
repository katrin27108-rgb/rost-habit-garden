"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";

type Habit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  completions: string[];
};

type Achievement = {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
};

type CommunityGarden = {
  publicId: string;
  displayName: string;
  habits: Habit[];
  totalCompletions: number;
  bestStreak: number;
  gardenStage: number;
  updatedAt: string;
};

type AccountStatus = "checking" | "unavailable" | "signed-out" | "connected" | "saving";

const STORAGE_KEY = "rost-habits-v1";
const ICONS = ["💧", "🧘", "📖", "🚶", "🌿", "☀️", "✍️", "🥗"];
const COLORS = ["#dff08c", "#f6a789", "#b9d8cf", "#c7b8eb", "#f4d579"];

const starterHabits: Habit[] = [
  { id: "water", name: "Стакан воды", icon: "💧", color: "#b9d8cf", completions: [] },
  { id: "stretch", name: "Растяжка", icon: "🧘", color: "#c7b8eb", completions: [] },
  { id: "read", name: "Читать 20 минут", icon: "📖", color: "#f4d579", completions: [] },
  { id: "walk", name: "Прогулка", icon: "🚶", color: "#f6a789", completions: [] },
];

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function habitStreak(habit: Habit) {
  const completed = new Set(habit.completions);
  let cursor = shiftDate(0);
  if (!completed.has(dateKey(cursor))) cursor = shiftDate(-1);

  let streak = 0;
  while (completed.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function daysSince(key: string | undefined) {
  if (!key) return 0;
  const last = new Date(`${key}T12:00:00`);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - last.getTime()) / 86_400_000));
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>(starterHabits);
  const [hydrated, setHydrated] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [communityGardens, setCommunityGardens] = useState<CommunityGarden[]>([]);
  const [selectedGarden, setSelectedGarden] = useState<CommunityGarden | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("checking");
  const [accountName, setAccountName] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(ICONS[0]);
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [toast, setToast] = useState("");
  const [burst, setBurst] = useState(0);

  const today = dateKey();
  const doneToday = habits.filter((habit) => habit.completions.includes(today));
  const undoneToday = habits.filter((habit) => !habit.completions.includes(today));
  const todayProgress = habits.length ? Math.round((doneToday.length / habits.length) * 100) : 0;
  const totalCompletions = habits.reduce((sum, habit) => sum + habit.completions.length, 0);
  const bestStreak = Math.max(0, ...habits.map(habitStreak));
  const energy = totalCompletions * 10;
  const gardenStage = Math.min(4, Math.floor(totalCompletions / 4) + 1);
  const stageProgress = gardenStage === 4 ? 100 : (totalCompletions % 4) * 25;
  const allCompletionDates = habits.flatMap((habit) => habit.completions).sort();
  const quietDays = daysSince(allCompletionDates.at(-1));
  const isResting = totalCompletions > 0 && doneToday.length === 0 && quietDays >= 2;
  const isWilting = totalCompletions > 0 && doneToday.length === 0 && quietDays >= 5;

  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(index - 6);
      const key = dateKey(date);
      const count = habits.filter((habit) => habit.completions.includes(key)).length;
      return {
        key,
        count,
        label: new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date).replace(".", ""),
        day: date.getDate(),
      };
    });
  }, [habits]);

  const achievements: Achievement[] = [
    { id: "seed", icon: "🌱", title: "Первый росток", description: "Выполнено первое действие", unlocked: totalCompletions >= 1 },
    { id: "day", icon: "☀️", title: "Зелёный день", description: "Все привычки за день", unlocked: todayProgress === 100 && habits.length > 0 },
    { id: "rhythm", icon: "🔥", title: "Ритм найден", description: "Серия из 3 дней", unlocked: bestStreak >= 3 },
    { id: "week", icon: "🕊️", title: "Неделя заботы", description: "Серия из 7 дней", unlocked: bestStreak >= 7 },
    { id: "garden", icon: "🌼", title: "Садовник", description: "25 выполненных действий", unlocked: totalCompletions >= 25 },
    { id: "bloom", icon: "🍎", title: "Полное цветение", description: "Открыта четвёртая стадия сада", unlocked: gardenStage === 4 },
  ];
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  const support = useMemo(() => {
    if (habits.length === 0) {
      return {
        title: "Здесь можно начать совсем маленько",
        text: "Посади одну привычку, которая сейчас правда тебе по силам. Не идеальную — живую.",
      };
    }
    if (todayProgress === 100) {
      return {
        title: "Посмотри, сколько жизни ты сегодня добавил",
        text: "Я горжусь тобой. Всё важное на сегодня уже сделано — можно просто побыть в своём саду.",
      };
    }
    if (doneToday.length === 1) {
      return {
        title: "Я горжусь тобой",
        text: "Ты сегодня сделал одно дело, но это уже настоящий вклад. Если найдётся время, выбери ещё одно и сделай его хотя бы чуть-чуть.",
      };
    }
    if (doneToday.length > 1) {
      return {
        title: "Ты уже создал движение",
        text: `Сегодня выполнено ${doneToday.length} действия. Не обесценивай их: именно из таких шагов и складывается устойчивый ритм.`,
      };
    }
    if (isWilting) {
      return {
        title: "Сад притих, но ничего не потеряно",
        text: "Пауза не отменяет твой путь. Одной небольшой отметки сегодня достаточно, чтобы в сад снова вернулся свет.",
      };
    }
    return {
      title: bestStreak > 0 ? "Твой ритм всё ещё с тобой" : "Я рядом — начнём без давления",
      text: "Выбери самое лёгкое дело. Можно сделать сокращённую версию — две минуты тоже считаются и помогают вернуться к себе.",
    };
  }, [bestStreak, doneToday.length, habits.length, isWilting, todayProgress]);

  const gardenCopy = isWilting
    ? { title: "Сад ждёт каплю заботы", text: "Одно действие вернёт краски и поднимет траву." }
    : isResting
      ? { title: "Тихий день в саду", text: "Он отдыхает вместе с тобой и готов ожить от следующего шага." }
      : todayProgress === 100
        ? { title: "Сегодня сад сияет", text: "Солнце, цветы и дерево откликнулись на твой полный день." }
        : doneToday.length > 0
          ? { title: "Сад заметил твои шаги", text: "С каждой отметкой становится больше света, травы и цветов." }
          : { title: "Утро только начинается", text: "Первая отметка разбудит свет и даст дереву новую ветвь." };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHabits(JSON.parse(saved) as Habit[]);
    } catch {
      // Keep the gentle starter set if local data is malformed.
    }
    setHydrated(true);

    if ("serviceWorker" in navigator) {
      const workerUrl = new URL("sw.js", window.location.href).pathname;
      navigator.serviceWorker.register(workerUrl).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const endpoint = new URL("api/garden", window.location.href).toString();

    fetch(endpoint, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) setAccountStatus("signed-out");
          return null;
        }
        if (!response.ok) {
          if (!cancelled) setAccountStatus("unavailable");
          return null;
        }
        return response.json();
      })
      .then((data) => {
        if (!data || cancelled) return;
        setAccountName(data.user?.displayName ?? "Садовник");
        if (Array.isArray(data.garden?.habits)) setHabits(data.garden.habits as Habit[]);
        setAccountStatus("connected");
        setCloudReady(true);
      })
      .catch(() => { if (!cancelled) setAccountStatus("unavailable"); });

    return () => { cancelled = true; };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !cloudReady || accountStatus !== "connected") return;
    const timeout = window.setTimeout(() => {
      const endpoint = new URL("api/garden", window.location.href).toString();
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habits, totalCompletions, bestStreak, gardenStage }),
      }).then((response) => {
        if (response.status === 401) setAccountStatus("signed-out");
      }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [accountStatus, bestStreak, cloudReady, gardenStage, habits, hydrated, totalCompletions]);

  function openCommunity() {
    if (accountStatus === "signed-out") {
      window.location.href = "/signin-with-chatgpt?return_to=/";
      return;
    }
    if (accountStatus !== "connected" && accountStatus !== "saving") return;
    setShowCommunity(true);
    setSelectedGarden(null);
    setCommunityLoading(true);
    const endpoint = new URL("api/community", window.location.href).toString();
    fetch(endpoint, { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : { gardens: [] })
      .then((data) => setCommunityGardens(Array.isArray(data.gardens) ? data.gardens : []))
      .catch(() => setCommunityGardens([]))
      .finally(() => setCommunityLoading(false));
  }

  function toggleHabit(id: string) {
    const habit = habits.find((item) => item.id === id);
    if (!habit) return;
    const isDone = habit.completions.includes(today);

    setHabits((current) =>
      current.map((item) => item.id !== id ? item : {
        ...item,
        completions: isDone
          ? item.completions.filter((day) => day !== today)
          : [...item.completions, today],
      }),
    );

    if (!isDone) {
      setBurst((value) => value + 1);
      const nextCount = doneToday.length + 1;
      setToast(nextCount === habits.length ? "Сад расцвёл — день завершён 🌼" : `+10 энергии · «${habit.name}» дало саду жизнь`);
      window.setTimeout(() => setToast(""), 2800);
    }
  }

  function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setHabits((current) => [...current, {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      icon: newIcon,
      color: newColor,
      completions: [],
    }]);
    setNewName("");
    setShowAdd(false);
    setToast("Новая привычка посажена 🌱");
    window.setTimeout(() => setToast(""), 2400);
  }

  function removeHabit(id: string) {
    setHabits((current) => current.filter((habit) => habit.id !== id));
  }

  const formattedDate = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Рост — на главную">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>рост</span>
        </a>
        <div className="topbar-date"><span>Сегодня</span><strong>{formattedDate}</strong></div>
        <div className="topbar-stats" aria-label="Краткая статистика">
          {accountStatus === "signed-out" ? (
            <a className="sync-pill" href="/signin-with-chatgpt?return_to=/"><b>☁</b><span>Войти</span></a>
          ) : accountStatus === "connected" || accountStatus === "saving" ? (
            <button className="sync-pill is-connected" onClick={openCommunity} aria-label="Облачный профиль и сады"><b>☁</b><span>{accountName}</span></button>
          ) : accountStatus === "unavailable" ? (
            <span className="sync-pill" title="Данные хранятся только на этом устройстве"><b>◌</b><span>На устройстве</span></span>
          ) : null}
          <button className="achievement-pill" onClick={() => setShowAchievements(true)} aria-label="Открыть достижения">
            <b>🏅</b> {unlockedCount}/{achievements.length}
          </button>
          <span className="energy-pill"><b>✦</b> {energy}</span>
          <span className="streak-pill"><b>🔥</b> {bestStreak} дн.</span>
        </div>
      </header>

      <section className="dashboard" id="top">
        <section className="panel habits-panel" aria-labelledby="today-title">
          <div className="section-heading">
            <div><p className="eyebrow">Твой ритм</p><h1 id="today-title">Сегодня</h1></div>
            <div className="progress-orb" style={{ "--progress": `${todayProgress * 3.6}deg` } as CSSProperties} aria-label={`Выполнено ${todayProgress}%`}>
              <span>{todayProgress}%</span>
            </div>
          </div>
          <p className="section-note">
            {todayProgress === 100 && habits.length > 0
              ? "Все привычки выполнены. Сад сегодня счастлив."
              : `Ещё ${Math.max(0, habits.length - doneToday.length)} — но даже один маленький шаг уже считается.`}
          </p>

          <div className="habit-list">
            {habits.map((habit) => {
              const isDone = habit.completions.includes(today);
              const streak = habitStreak(habit);
              return (
                <article className={`habit-card ${isDone ? "is-done" : ""}`} key={habit.id}>
                  <button className="habit-check" style={{ "--habit-color": habit.color } as CSSProperties} aria-label={isDone ? `Отменить выполнение: ${habit.name}` : `Выполнить: ${habit.name}`} aria-pressed={isDone} onClick={() => toggleHabit(habit.id)}>
                    <span className="habit-icon" aria-hidden="true">{habit.icon}</span><span className="check-mark" aria-hidden="true">✓</span>
                  </button>
                  <button className="habit-main" onClick={() => toggleHabit(habit.id)}>
                    <strong>{habit.name}</strong><span>{streak > 0 ? `${streak} ${streak === 1 ? "день" : "дней"} подряд` : "Начать серию"}</span>
                  </button>
                  <button className="habit-remove" aria-label={`Удалить привычку: ${habit.name}`} onClick={() => removeHabit(habit.id)}>×</button>
                </article>
              );
            })}
            {habits.length === 0 && <div className="empty-state"><span>🌱</span><strong>Здесь пока тихо</strong><p>Посади первую привычку — и сад начнёт расти.</p></div>}
          </div>

          <button className="add-button" onClick={() => setShowAdd(true)}><span>＋</span> Добавить привычку</button>
        </section>

        <section className="panel garden-panel" aria-labelledby="garden-title">
          <div className="garden-heading">
            <div><p className="eyebrow">Живой сад</p><h2 id="garden-title">Твоё место силы</h2></div>
            <span className="level-badge">Стадия {gardenStage} из 4</span>
          </div>

          <div className={`garden-scene stage-${gardenStage} ${isResting ? "is-resting" : ""} ${isWilting ? "is-wilting" : ""} ${burst ? "just-grew" : ""}`} key={`${burst}-${gardenStage}`}>
            <img src={`garden/stage-${gardenStage}.webp`} alt={`Сад на ${gardenStage} стадии роста`} />
            <div className="garden-vignette" aria-hidden="true" />
            <div className="sun-glow" aria-hidden="true" />
            <div className="weather" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <div className="growth-sparkles" aria-hidden="true"><i>✦</i><i>•</i><i>✦</i><i>•</i></div>
            <div className="garden-story">
              <span className="garden-mood">{isWilting ? "сад скучает" : isResting ? "сад отдыхает" : todayProgress === 100 ? "полное сияние" : "сад растёт"}</span>
              <strong>{gardenCopy.title}</strong>
              <p>{gardenCopy.text}</p>
            </div>
            <div className="garden-energy" aria-label={`Энергия сада ${stageProgress}%`}><span style={{ width: `${stageProgress}%` }} /></div>
          </div>

          <div className="growth-footer">
            <div><strong>{gardenStage === 4 ? "Сад в полном цвету" : `${4 - (totalCompletions % 4)} действия до новой стадии`}</strong><span>Каждая отметка меняет сам пейзаж.</span></div>
            <div className="garden-actions">
              <div className="growth-dots" aria-label={`Стадия роста ${gardenStage} из 4`}>{[1, 2, 3, 4].map((stage) => <i className={stage <= gardenStage ? "active" : ""} key={stage} />)}</div>
              {(accountStatus === "connected" || accountStatus === "saving" || accountStatus === "signed-out") && <button className="visit-button" onClick={openCommunity}>Гулять по садам</button>}
            </div>
          </div>
        </section>

        <aside className="side-column" aria-label="Поддержка и статистика">
          <section className="panel support-panel">
            <div className="support-orb" aria-hidden="true">✦</div>
            <p className="eyebrow">Тёплое напоминание</p>
            <h2>{support.title}</h2>
            <p>{support.text}</p>
            {undoneToday[0] && <div className="gentle-step"><span>Можно начать с</span><strong>{undoneToday[0].icon} {undoneToday[0].name}</strong></div>}
          </section>

          <section className="panel achievements-panel">
            <div className="section-heading compact">
              <div><p className="eyebrow">Твои следы</p><h2>Достижения</h2></div>
              <button className="text-button" onClick={() => setShowAchievements(true)}>Все</button>
            </div>
            <div className="achievement-preview">
              {achievements.slice(0, 4).map((achievement) => (
                <div className={achievement.unlocked ? "unlocked" : "locked"} key={achievement.id} title={achievement.description}>
                  <span>{achievement.icon}</span><b>{achievement.title}</b>
                </div>
              ))}
            </div>
            <div className="achievement-progress"><span style={{ width: `${(unlockedCount / achievements.length) * 100}%` }} /></div>
            <small>Открыто {unlockedCount} из {achievements.length}</small>
          </section>

          <section className="panel week-panel">
            <div className="section-heading compact"><div><p className="eyebrow">Последние 7 дней</p><h2>Неделя</h2></div><span className="week-total">{week.reduce((sum, day) => sum + day.count, 0)} ✓</span></div>
            <div className="week-chart" aria-label="Выполнения по дням недели">
              {week.map((day) => {
                const height = habits.length ? Math.max(8, (day.count / habits.length) * 100) : 8;
                return <div className={`week-day ${day.key === today ? "is-today" : ""}`} key={day.key}><div className="bar-track"><span style={{ height: `${height}%` }} /></div><b>{day.label}</b><small>{day.day}</small></div>;
              })}
            </div>
          </section>

          <section className="quick-stats" aria-label="Итоги">
            <div><span>Выполнено действий</span><strong>{totalCompletions}</strong></div>
            <div><span>Лучший ритм</span><strong>{bestStreak} <small>дн.</small></strong></div>
          </section>
        </aside>
      </section>

      {showAdd && <div className="modal-backdrop" role="presentation"><form className="habit-modal" onSubmit={addHabit} aria-labelledby="new-habit-title">
        <button className="modal-close" type="button" onClick={() => setShowAdd(false)} aria-label="Закрыть">×</button>
        <p className="eyebrow">Новое семечко</p><h2 id="new-habit-title">Добавить привычку</h2>
        <label className="field-label" htmlFor="habit-name">Что хочешь делать?</label>
        <input id="habit-name" autoFocus maxLength={42} placeholder="Например, медитировать 5 минут" value={newName} onChange={(event) => setNewName(event.target.value)} />
        <span className="field-label">Выбери символ</span><div className="choice-row" aria-label="Символ привычки">{ICONS.map((icon) => <button type="button" className={newIcon === icon ? "selected" : ""} aria-label={`Выбрать ${icon}`} aria-pressed={newIcon === icon} onClick={() => setNewIcon(icon)} key={icon}>{icon}</button>)}</div>
        <span className="field-label">Цвет</span><div className="color-row" aria-label="Цвет привычки">{COLORS.map((color) => <button type="button" className={newColor === color ? "selected" : ""} style={{ background: color }} aria-label={`Выбрать цвет ${color}`} aria-pressed={newColor === color} onClick={() => setNewColor(color)} key={color} />)}</div>
        <button className="modal-submit" type="submit" disabled={!newName.trim()}>Посадить привычку <span>→</span></button>
      </form></div>}

      {showAchievements && <div className="modal-backdrop" role="presentation"><section className="achievement-modal" role="dialog" aria-modal="true" aria-labelledby="achievements-title">
        <button className="modal-close" type="button" onClick={() => setShowAchievements(false)} aria-label="Закрыть">×</button>
        <p className="eyebrow">Твоя история роста</p><h2 id="achievements-title">Достижения</h2>
        <p className="modal-intro">Это не оценки. Это следы того, как ты заботился о себе — даже понемногу.</p>
        <div className="achievement-grid">{achievements.map((achievement) => <article className={achievement.unlocked ? "unlocked" : "locked"} key={achievement.id}><span>{achievement.unlocked ? achievement.icon : "·"}</span><div><strong>{achievement.title}</strong><p>{achievement.description}</p></div><b>{achievement.unlocked ? "Открыто" : "Впереди"}</b></article>)}</div>
      </section></div>}

      {showCommunity && <div className="modal-backdrop" role="presentation"><section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="community-title">
        <button className="modal-close" type="button" onClick={() => setShowCommunity(false)} aria-label="Закрыть">×</button>
        {selectedGarden ? <>
          <button className="back-button" onClick={() => setSelectedGarden(null)}>← Все сады</button>
          <p className="eyebrow">В гостях</p><h2 id="community-title">Сад: {selectedGarden.displayName}</h2>
          <div className="visited-garden"><img src={`garden/stage-${Math.min(4, Math.max(1, selectedGarden.gardenStage))}.webp`} alt={`Сад пользователя ${selectedGarden.displayName}`} /><div><span>Стадия {selectedGarden.gardenStage} из 4</span><strong>{selectedGarden.totalCompletions} добрых действий</strong></div></div>
          <div className="visitor-stats"><div><span>Лучший ритм</span><strong>{selectedGarden.bestStreak} дн.</strong></div><div><span>Посажено привычек</span><strong>{selectedGarden.habits.length}</strong></div></div>
          <p className="visitor-note">Ты здесь как тихий гость: можешь смотреть и вдохновляться, но чужие привычки остаются только у хозяина сада.</p>
        </> : <>
          <p className="eyebrow">Сообщество</p><h2 id="community-title">Прогулка по садам</h2>
          <p className="modal-intro">Здесь виден только сам сад и общий прогресс. Личные данные и названия привычек не раскрываются в списке.</p>
          {communityLoading ? <div className="community-empty">Открываю калитки…</div> : communityGardens.length === 0 ? <div className="community-empty"><span>🌿</span><strong>Пока здесь тихо</strong><p>Когда появятся другие зарегистрированные садовники, их сады будут ждать здесь.</p></div> : <div className="community-grid">{communityGardens.map((garden) => <button key={garden.publicId} onClick={() => setSelectedGarden(garden)}><img src={`garden/stage-${Math.min(4, Math.max(1, garden.gardenStage))}.webp`} alt="" /><span><strong>{garden.displayName}</strong><small>Стадия {garden.gardenStage} · {garden.totalCompletions} действий</small></span></button>)}</div>}
        </>}
      </section></div>}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
