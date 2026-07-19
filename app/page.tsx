"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { isStoredHabit, migrateLegacyHabits, metricsForHabit, createStoredHabit, BACKUP_STORAGE_KEY, LEGACY_STORAGE_KEY, STORAGE_KEY, type LegacyHabit, type NewHabitInput, type StoredHabit } from "../lib/app-model";
import type { DateKey } from "../lib/domain";
import { enqueueOperation, loadHabitSnapshot, newOperation, saveHabitSnapshot } from "../lib/offline-store";
import { messageForDay } from "../lib/messages";
import HabitWizard from "./HabitWizard";
import LivingGarden, { type GardenPlant } from "./LivingGarden";
import StatsPanel from "./StatsPanel";
import SettingsModal from "./SettingsModal";
import AuthModal from "./AuthModal";

type Habit = StoredHabit;

type Achievement = {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  reward: number;
};

type CommunityGarden = {
  publicId: string;
  displayName: string;
  plants: GardenPlant[];
  plantCount: number;
  totalCompletions: number;
  bestStreak: number;
  gardenStage: number;
  updatedAt: string;
};

type AccountStatus = "checking" | "unavailable" | "signed-out" | "connected" | "saving";
type RewardState = { spent: number; inventory: string[]; fertilizerUntil?: string };
const SHOP = [{ code: "fertilizer", title: "Удобрение", icon: "✨", price: 20 }, { code: "flower", title: "Декоративный цветок", icon: "🌷", price: 25 }, { code: "lantern", title: "Фонарь", icon: "🏮", price: 40 }, { code: "feeder", title: "Кормушка", icon: "🐦", price: 60 }, { code: "bench", title: "Скамейка", icon: "🪑", price: 80 }, { code: "fountain", title: "Фонтан", icon: "⛲", price: 150 }, { code: "pond", title: "Большой пруд", icon: "🪷", price: 250 }];

const starterLegacyHabits: LegacyHabit[] = [
  { id: "water", name: "Стакан воды", icon: "💧", color: "#b9d8cf", completions: [] },
  { id: "stretch", name: "Растяжка", icon: "🧘", color: "#c7b8eb", completions: [] },
  { id: "read", name: "Читать 20 минут", icon: "📖", color: "#f4d579", completions: [] },
  { id: "walk", name: "Прогулка", icon: "🚶", color: "#f6a789", completions: [] },
];

function dateKey(date = new Date()): DateKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as DateKey;
}

function daysSince(key: string | undefined) {
  if (!key) return 0;
  const last = new Date(`${key}T12:00:00`);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - last.getTime()) / 86_400_000));
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>(() => migrateLegacyHabits(starterLegacyHabits, dateKey()));
  const [hydrated, setHydrated] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [communityGardens, setCommunityGardens] = useState<CommunityGarden[]>([]);
  const [selectedGarden, setSelectedGarden] = useState<CommunityGarden | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("checking");
  const [accountName, setAccountName] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [toast, setToast] = useState("");
  const [burst, setBurst] = useState(0);
  const [focusPlantId, setFocusPlantId] = useState<string>();
  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [rewardState, setRewardState] = useState<RewardState>({ spent: 0, inventory: [] });

  const today = dateKey();
  const visibleHabits = habits.filter((habit) => habit.status !== "deleted");
  const doneToday = visibleHabits.filter((habit) => habit.completions.includes(today));
  const undoneToday = visibleHabits.filter((habit) => !habit.completions.includes(today));
  const todayProgress = visibleHabits.length ? Math.round((doneToday.length / visibleHabits.length) * 100) : 0;
  const totalCompletions = visibleHabits.reduce((sum, habit) => sum + habit.completions.length, 0);
  const metrics = useMemo(() => new Map(visibleHabits.map((habit) => [habit.id, metricsForHabit(habit, today)])), [habits, today]);
  const bestStreak = Math.max(0, ...visibleHabits.map((habit) => metrics.get(habit.id)?.bestStreak ?? 0));
  const gardenProgress = visibleHabits.length ? visibleHabits.reduce((sum, habit) => sum + (metrics.get(habit.id)?.progress ?? 0), 0) / visibleHabits.length : 0;
  const gardenPercent = Math.round(gardenProgress * 100);
  const gardenDay = gardenPercent;
  const gardenPlants = useMemo<GardenPlant[]>(() => visibleHabits.map((habit) => ({
    id: habit.id, kind: habit.plantKind, slot: habit.gardenSlot, color: habit.color,
    progress: metrics.get(habit.id)?.progress ?? 0, health: metrics.get(habit.id)?.health ?? 100,
    fertilized: Boolean(rewardState.fertilizerUntil && new Date(rewardState.fertilizerUntil) > new Date()),
  })), [habits, metrics, rewardState.fertilizerUntil]);
  const gardenStage = Math.min(4, Math.max(1, Math.ceil(gardenProgress * 4)));
  const allCompletionDates = habits.flatMap((habit) => habit.completions).sort();
  const quietDays = daysSince(allCompletionDates.at(-1));
  const isResting = totalCompletions > 0 && doneToday.length === 0 && quietDays >= 2;
  const isWilting = totalCompletions > 0 && doneToday.length === 0 && quietDays >= 5;

  const achievements: Achievement[] = [
    { id: "seed", icon: "🌱", title: "Первое семечко", description: "Посажена первая привычка", unlocked: visibleHabits.length >= 1, reward: 5 },
    { id: "rhythm3", icon: "🔥", title: "Три шага", description: "Серия из 3 действий", unlocked: bestStreak >= 3, reward: 5 },
    { id: "rhythm7", icon: "🕊️", title: "Неделя ритма", description: "Серия из 7 действий", unlocked: bestStreak >= 7, reward: 10 },
    { id: "rhythm14", icon: "🌿", title: "Две недели", description: "Серия из 14 действий", unlocked: bestStreak >= 14, reward: 15 },
    { id: "rhythm30", icon: "🌳", title: "Месяц заботы", description: "Серия из 30 действий", unlocked: bestStreak >= 30, reward: 30 },
    { id: "day", icon: "☀️", title: "Идеальный день", description: "Весь план дня выполнен", unlocked: todayProgress === 100 && visibleHabits.length > 0, reward: 5 },
    { id: "week", icon: "✨", title: "Идеальная неделя", description: "Весь недельный план выполнен", unlocked: bestStreak >= 7, reward: 20 },
    { id: "return", icon: "🌦️", title: "Возвращение", description: "Сад ожил после тихих дней", unlocked: quietDays >= 2 && doneToday.length > 0, reward: 10 },
    { id: "adult", icon: "🌸", title: "Взрослое растение", description: "Первое растение полностью выросло", unlocked: [...metrics.values()].some((item) => item.progress >= 1), reward: 20 },
    { id: "grove", icon: "🌲", title: "Роща", description: "Пять взрослых растений", unlocked: [...metrics.values()].filter((item) => item.progress >= 1).length >= 5, reward: 50 },
    { id: "variety", icon: "💐", title: "Разнообразный сад", description: "В саду растут пять разных видов", unlocked: new Set(visibleHabits.map((habit) => habit.plantKind)).size >= 5, reward: 25 },
    { id: "secret", icon: "❔", title: "Секретный след", description: "Откроется в особенный момент", unlocked: false, reward: 15 },
  ];
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  const earnedStars = totalCompletions + achievements.filter((achievement) => achievement.unlocked).reduce((sum, achievement) => sum + achievement.reward, 0);
  const energy = Math.max(0, earnedStars - rewardState.spent);

  const support = useMemo(() => {
    if (visibleHabits.length === 0) {
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
    const daily = messageForDay(today);
    return {
      title: bestStreak > 0 ? "Твой ритм всё ещё с тобой" : "Я рядом — начнём без давления",
      text: daily.text,
    };
  }, [bestStreak, doneToday.length, visibleHabits.length, isWilting, todayProgress]);

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
    if (new URLSearchParams(window.location.search).get("new") === "1") setShowAdd(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const indexed = await loadHabitSnapshot();
        if (indexed?.length && indexed.every(isStoredHabit)) {
          if (!cancelled) setHabits(indexed);
          return;
        }
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as unknown[];
          if (Array.isArray(parsed) && parsed.every(isStoredHabit) && !cancelled) setHabits(parsed);
        } else {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            if (!localStorage.getItem(BACKUP_STORAGE_KEY)) localStorage.setItem(BACKUP_STORAGE_KEY, legacy);
            const parsed = JSON.parse(legacy) as LegacyHabit[];
            if (Array.isArray(parsed) && !cancelled) setHabits(migrateLegacyHabits(parsed, today));
          }
        }
      } catch {
        // The starter garden remains available if local recovery fails.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void restore();

    if ("serviceWorker" in navigator) {
      const workerUrl = new URL("sw.js", window.location.href).pathname;
      navigator.serviceWorker.register(workerUrl).catch(() => undefined);
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
      void saveHabitSnapshot(habits);
    }
  }, [habits, hydrated]);

  useEffect(() => {
    try { const saved = localStorage.getItem("rost-rewards-v1"); if (saved) setRewardState(JSON.parse(saved)); } catch {}
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem("rost-rewards-v1", JSON.stringify(rewardState)); }, [hydrated, rewardState]);

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
        if (Array.isArray(data.garden?.habits)) {
          const cloudHabits = data.garden.habits as unknown[];
          setHabits(cloudHabits.every(isStoredHabit) ? cloudHabits : migrateLegacyHabits(cloudHabits as LegacyHabit[], today));
        }
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
      setShowAuth(true);
      return;
    }
    if (accountStatus !== "connected" && accountStatus !== "saving") return;
    setShowCommunity(true);
    setSelectedGarden(null);
    setCommunityLoading(true);
    const endpoint = new URL("api/community", window.location.href).toString();
    fetch(endpoint, { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : { gardens: [] })
      .then((data) => {
        setCommunityGardens(Array.isArray(data.gardens) ? data.gardens : []);
        setSharedWith(Array.isArray(data.sharedWith) ? data.sharedWith : []);
      })
      .catch(() => setCommunityGardens([]))
      .finally(() => setCommunityLoading(false));
  }

  function signOut() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => window.location.reload());
  }

  function inviteToGarden() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    const endpoint = new URL("api/community", window.location.href).toString();
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitorEmail: email }) })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? "Не получилось дать доступ");
        setSharedWith((current) => current.includes(email) ? current : [...current, email]);
        setInviteEmail("");
        setToast("Калитка открыта — этот человек сможет увидеть ваш сад");
      })
      .catch((error) => setToast(error instanceof Error ? error.message : "Не получилось дать доступ"));
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
      setFocusPlantId(id);
      setBurst((value) => value + 1);
      const nextCount = doneToday.length + 1;
      setToast(nextCount === visibleHabits.length ? "Сад расцвёл — день завершён 🌼" : `+10 энергии · «${habit.name}» дало саду жизнь`);
      window.setTimeout(() => setToast(""), 2800);
    }
    void enqueueOperation(newOperation(isDone ? "completion.remove" : "completion.add", id, { localDate: today }));
  }

  function addHabit(input: NewHabitInput) {
    const id = crypto.randomUUID();
    const habit = createStoredHabit(input, id, new Set(habits.map((item) => item.gardenSlot)));
    const nextHabits = [...habits, habit];
    setHabits(nextHabits);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHabits));
    void saveHabitSnapshot(nextHabits);
    void enqueueOperation(newOperation("habit.create", id, input as unknown as Record<string, unknown>));
    setShowAdd(false);
    sessionStorage.setItem("rost-pending-plant", id);
    setToast("Семечко готово — выбери ему место в саду 🌱");
    window.setTimeout(() => { window.location.href = `/garden-prototype?place=${encodeURIComponent(id)}`; }, 500);
  }

  function removeHabit(id: string) {
    setHabits((current) => current.map((habit) => habit.id === id ? { ...habit, status: "deleted", updatedAt: new Date().toISOString() } : habit));
    void enqueueOperation(newOperation("habit.delete", id, {}));
  }

  function buyItem(code: string, price: number) {
    if (energy < price) { setToast("Пока не хватает звёзд — они придут с заботой о привычках"); window.setTimeout(() => setToast(""), 2600); return; }
    const operation = newOperation("purchase", code, { itemCode: code });
    setRewardState((current) => ({
      spent: current.spent + price, inventory: [...current.inventory, code],
      fertilizerUntil: code === "fertilizer" ? new Date(Date.now() + 86_400_000).toISOString() : current.fertilizerUntil,
    }));
    void enqueueOperation(operation);
    setToast(code === "fertilizer" ? "Сад сияет — цветение включено на 24 часа ✨" : "Новое украшение ждёт своего места в саду");
    window.setTimeout(() => setToast(""), 2600);
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
            <button className="sync-pill" onClick={() => setShowAuth(true)}><b>☁</b><span>Войти</span></button>
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
          <button className="settings-pill" onClick={() => setShowSettings(true)} aria-label="Настройки">⚙</button>
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
            {todayProgress === 100 && visibleHabits.length > 0
              ? "Все привычки выполнены. Сад сегодня счастлив."
              : `Ещё ${Math.max(0, visibleHabits.length - doneToday.length)} — но даже один маленький шаг уже считается.`}
          </p>

          <div className="habit-list">
            {visibleHabits.map((habit) => {
              const isDone = habit.completions.includes(today);
              const habitProgress = metrics.get(habit.id);
              const streak = habitProgress?.currentStreak ?? 0;
              return (
                <article className={`habit-card ${isDone ? "is-done" : ""}`} key={habit.id}>
                  <button className="habit-check" style={{ "--habit-color": habit.color } as CSSProperties} aria-label={isDone ? `Отменить выполнение: ${habit.name}` : `Выполнить: ${habit.name}`} aria-pressed={isDone} onClick={() => toggleHabit(habit.id)}>
                    <span className="habit-icon" aria-hidden="true">{habit.icon}</span><span className="check-mark" aria-hidden="true">✓</span>
                  </button>
                  <button className="habit-main" onClick={() => toggleHabit(habit.id)}>
                    <strong>{habit.name}</strong><span>{streak > 0 ? `${streak} ${streak === 1 ? "шаг" : "шагов"} подряд · ${Math.round((habitProgress?.progress ?? 0) * 100)}% роста` : `${Math.round((habitProgress?.progress ?? 0) * 100)}% роста растения`}</span>
                  </button>
                  <button className="habit-remove" aria-label={`Удалить привычку: ${habit.name}`} onClick={() => removeHabit(habit.id)}>×</button>
                </article>
              );
            })}
            {visibleHabits.length === 0 && <div className="empty-state"><span>🌱</span><strong>Здесь пока тихо</strong><p>Посади первую привычку — и сад начнёт расти.</p></div>}
          </div>

          <button className="add-button" onClick={() => setShowAdd(true)}><span>＋</span> Добавить привычку</button>
        </section>

        <section className="panel garden-panel" aria-labelledby="garden-title">
          <div className="garden-heading">
            <div><p className="eyebrow">Живой сад</p><h2 id="garden-title">Твоё место силы</h2></div>
            <span className="level-badge">Сад вырос на {gardenDay}%</span>
          </div>

          <div className={`garden-scene ${isResting ? "is-resting" : ""} ${isWilting ? "is-wilting" : ""}`}>
            <LivingGarden progress={gardenProgress} todayEnergy={todayProgress / 100} quietDays={quietDays} burst={burst} plants={gardenPlants} focusPlantId={focusPlantId} />
            <div className="garden-story">
              <span className="garden-mood">{isWilting ? "сад скучает" : isResting ? "сад отдыхает" : todayProgress === 100 ? "полное сияние" : "сад растёт"}</span>
              <strong>{gardenCopy.title}</strong>
              <p>{gardenCopy.text}</p>
            </div>
            <div className="garden-energy" aria-label={`Месячный рост сада ${gardenPercent}%`}><span style={{ width: `${gardenPercent}%` }} /></div>
          </div>

          <div className="growth-footer">
            <div><strong>{gardenProgress >= 1 ? "Первый сезон в полном цвету" : `${gardenPercent}% месячного пути`}</strong><span>Ствол, ветви, листья и цветы растут плавно — без скачков между картинками.</span></div>
            <div className="garden-actions">
              <span className="month-counter">{gardenDay}% сада</span>
              <a className="walk-button" href="/garden-prototype"><span aria-hidden="true">↗</span> Войти в 3D-сад</a>
              {(accountStatus === "connected" || accountStatus === "saving" || accountStatus === "signed-out") && <button className="visit-button" onClick={openCommunity}>Сады друзей</button>}
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

          <StatsPanel habits={visibleHabits} today={today} />

          <section className="quick-stats" aria-label="Итоги">
            <div><span>Выполнено действий</span><strong>{totalCompletions}</strong></div>
            <div><span>Лучший ритм</span><strong>{bestStreak} <small>дн.</small></strong></div>
          </section>
        </aside>
      </section>

      {showAdd && <HabitWizard onClose={() => setShowAdd(false)} onCreate={addHabit} />}

      {showAchievements && <div className="modal-backdrop" role="presentation"><section className="achievement-modal" role="dialog" aria-modal="true" aria-labelledby="achievements-title">
        <button className="modal-close" type="button" onClick={() => setShowAchievements(false)} aria-label="Закрыть">×</button>
        <p className="eyebrow">Твоя история роста</p><h2 id="achievements-title">Достижения</h2>
        <p className="modal-intro">Это не оценки. Это следы того, как ты заботился о себе — даже понемногу.</p>
        <div className="achievement-grid">{achievements.map((achievement) => <article className={achievement.unlocked ? "unlocked" : "locked"} key={achievement.id}><span>{achievement.unlocked ? achievement.icon : "·"}</span><div><strong>{achievement.title}</strong><p>{achievement.description}</p></div><b>{achievement.unlocked ? `+${achievement.reward} ✦` : "Впереди"}</b></article>)}</div>
        <div className="shop-heading"><div><p className="eyebrow">Для твоего сада</p><h3>Магазин</h3></div><strong>✦ {energy}</strong></div>
        <div className="shop-grid">{SHOP.map((item) => <button key={item.code} disabled={energy < item.price} onClick={() => buyItem(item.code, item.price)}><span>{item.icon}</span><b>{item.title}</b><small>{item.price} ✦</small></button>)}</div>
      </section></div>}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showCommunity && <div className="modal-backdrop" role="presentation"><section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="community-title">
        <button className="modal-close" type="button" onClick={() => setShowCommunity(false)} aria-label="Закрыть">×</button>
        {selectedGarden ? <>
          <button className="back-button" onClick={() => setSelectedGarden(null)}>← Все сады</button>
          <p className="eyebrow">В гостях</p><h2 id="community-title">Сад: {selectedGarden.displayName}</h2>
          <div className="visited-garden"><LivingGarden progress={selectedGarden.plants.length ? selectedGarden.plants.reduce((sum, plant) => sum + plant.progress, 0) / selectedGarden.plants.length : 0} plants={selectedGarden.plants} todayEnergy={.7} quietDays={0} burst={0} label={`Живой сад пользователя ${selectedGarden.displayName}`} /><div className="visited-garden-caption"><span>Живой сад</span><strong>{selectedGarden.totalCompletions} добрых действий</strong></div></div>
          <div className="visitor-stats"><div><span>Лучший ритм</span><strong>{selectedGarden.bestStreak} дн.</strong></div><div><span>Растений в саду</span><strong>{selectedGarden.plantCount}</strong></div></div>
          <p className="visitor-note">Ты здесь как тихий гость: можешь смотреть и вдохновляться, но чужие привычки остаются только у хозяина сада.</p>
        </> : <>
          <p className="eyebrow">Сообщество</p><h2 id="community-title">Прогулка по садам</h2>
          <p className="modal-intro">Здесь виден только сам сад и общий прогресс. Личные данные и названия привычек не раскрываются в списке.</p>
          <section className="garden-invite">
            <div><strong>Открыть калитку другу</strong><span>Только приглашённый пользователь сможет увидеть ваш сад.</span></div>
            <div className="garden-invite-row"><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Почта друга" /><button onClick={inviteToGarden}>Дать доступ</button></div>
            {sharedWith.length > 0 && <small>Доступ есть: {sharedWith.join(", ")}</small>}
          </section>
          {communityLoading ? <div className="community-empty">Открываю калитки…</div> : communityGardens.length === 0 ? <div className="community-empty"><span>🌿</span><strong>Пока здесь тихо</strong><p>Когда появятся приглашённые садовники, их сады будут ждать здесь.</p></div> : <div className="community-grid">{communityGardens.map((garden) => <button key={garden.publicId} onClick={() => setSelectedGarden(garden)}><i className="garden-card-seed" aria-hidden="true">🌳</i><span><strong>{garden.displayName}</strong><small>{garden.plantCount} растений · {garden.totalCompletions} действий</small></span></button>)}</div>}
          <button className="community-signout" type="button" onClick={signOut}>Выйти из аккаунта</button>
        </>}
      </section></div>}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
