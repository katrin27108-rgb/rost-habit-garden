"use client";

import { useEffect, useRef, useState } from "react";
import { isStoredHabit, metricsForHabit, STORAGE_KEY, type StoredHabit } from "../lib/app-model";
import { saveHabitSnapshot } from "../lib/offline-store";
import type { PlantKind as SpeciesKind } from "../lib/domain";
import { loadBabylon } from "./garden3d/babylon";
import {
  createGardenGame,
  type DecorationKind,
  type GameNotice,
  type GameWeather,
  type GardenGameRuntime,
  type PlacementItem,
  type PlantKind,
  type TimeOfDay,
} from "./garden3d/stylizedGame";
import styles from "./garden-prototype/garden-3d-prototype.module.css";

const WEATHER_COPY: Record<GameWeather, { title: string; text: string }> = {
  sun: { title: "Ясно", text: "Тёплый свет и спокойный сад" },
  cloud: { title: "Облачно", text: "Мягкий рассеянный свет" },
  rain: { title: "Дождь", text: "Вода, листья и трава оживают" },
};

const PLANTS: Array<{ kind: PlantKind; icon: string; title: string; text: string }> = [
  { kind: "tree", icon: "♧", title: "Дерево", text: "Для долгой привычки" },
  { kind: "flowers", icon: "✿", title: "Цветы", text: "Для ежедневной заботы" },
  { kind: "shrub", icon: "❋", title: "Цветущий куст", text: "Для мягкого ритма" },
];

const SHOP_ITEMS: Array<{ kind: DecorationKind; icon: string; title: string; text: string; cost: number }> = [
  { kind: "fertilizer", icon: "✦", title: "Удобрение", text: "+8% роста после размещения", cost: 12 },
  { kind: "lantern", icon: "♨", title: "Тёплый фонарь", text: "Светит именно там, где вы поставите", cost: 18 },
  { kind: "birdhouse", icon: "⌂", title: "Домик для птиц", text: "Украшение для выбранного места", cost: 24 },
  { kind: "bench", icon: "▰", title: "Садовая скамья", text: "Место остановиться и выдохнуть", cost: 32 },
  { kind: "pond", icon: "◉", title: "Новый пруд", text: "Большой уголок с водой, камнями и кувшинками", cost: 120 },
];

type PendingPlacement = { item: PlacementItem; title: string; cost: number };

const TREE_SPECIES = new Set<SpeciesKind>(["oak", "cherry", "birch", "willow"]);
const FLOWER_SPECIES = new Set<SpeciesKind>(["lavender", "chamomile", "sunflower", "peony", "strawberry"]);

function engineKind(species: SpeciesKind): PlantKind {
  if (TREE_SPECIES.has(species)) return "tree";
  if (FLOWER_SPECIES.has(species)) return "flowers";
  return "shrub";
}

function durationDays(habit: StoredHabit) {
  return Math.max(1, Math.round((new Date(`${habit.endsOn}T12:00:00`).getTime() - new Date(`${habit.startsOn}T12:00:00`).getTime()) / 86_400_000) + 1);
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` as `${number}-${number}-${number}`;
}

function habitItem(habit: StoredHabit): Extract<PlacementItem, { category: "plant" }> {
  return {
    category: "plant",
    kind: engineKind(habit.plantKind),
    species: habit.plantKind,
    habitId: habit.id,
    habitName: habit.name,
    growth: Math.round(metricsForHabit(habit, todayKey()).progress * 100),
    durationDays: durationDays(habit),
  };
}

function slotPosition(slot: number) {
  const positions = [
    [-4.5, -3.4], [4.7, -3.3], [-4.2, 5.4], [4.2, 5.2], [8.4, -.8], [-8.2, -5.6],
    [8.1, 4.2], [-2.3, 8.2], [2.5, 8], [-10.8, -2], [10.8, -5.3], [6.7, -7.2],
  ];
  const [x, z] = positions[slot % positions.length];
  return { x, z };
}

function loadSiteHabits(): StoredHabit[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown[];
    return Array.isArray(parsed) ? parsed.filter(isStoredHabit).filter((habit) => habit.status !== "deleted") : [];
  } catch {
    return [];
  }
}

export default function Garden3DPrototype() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GardenGameRuntime | null>(null);
  const pendingRef = useRef<PendingPlacement | null>(null);
  const growthAnimationRef = useRef<number | null>(null);
  const [siteHabits, setSiteHabits] = useState<StoredHabit[]>(loadSiteHabits);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [growth, setGrowth] = useState(() => siteHabits[0] ? Math.round(metricsForHabit(siteHabits[0], todayKey()).progress * 100) : 5);
  const [nearby, setNearby] = useState<GameNotice>(null);
  const [dialog, setDialog] = useState<GameNotice>(null);
  const [weather, setWeather] = useState<GameWeather>(() => initialWeather());
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => timeFromDevice());
  const [activePanel, setActivePanel] = useState<"plant" | "shop" | null>(null);
  const [stars, setStars] = useState(46);
  const [habitName, setHabitName] = useState("");
  const [habitDuration, setHabitDuration] = useState(30);
  const [selectedPlant, setSelectedPlant] = useState<PlantKind>("tree");
  const [placement, setPlacement] = useState<PendingPlacement | null>(null);
  const [growthDemo, setGrowthDemo] = useState(false);
  const [toast, setToast] = useState("");
  const focusHabit = siteHabits[0];

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const requestedId = new URLSearchParams(window.location.search).get("place") ?? sessionStorage.getItem("rost-pending-plant");
    const pendingHabit = siteHabits.find((habit) => habit.id === requestedId);
    const initialPlants = siteHabits.filter((habit) => habit.id !== requestedId).map((habit) => ({
      item: habitItem(habit),
      position: habit.gardenPosition ?? slotPosition(habit.gardenSlot),
    }));
    loadBabylon()
      .then((B) => createGardenGame(B, canvas, {
        growth,
        initialPlants,
        onReady: () => { if (!cancelled) setReady(true); },
        onNearby: (notice) => { if (!cancelled) setNearby(notice); },
        onInteract: (notice) => { if (!cancelled) setDialog(expandNotice(notice, growth)); },
        onPlacementComplete: (placedItem, position) => {
          if (cancelled) return;
          const pending = pendingRef.current;
          if (!pending) return;
          if (pending.cost) setStars((value) => value - pending.cost);
          if (pending.item.category === "decoration" && pending.item.kind === "fertilizer") {
            setGrowth((value) => Math.min(100, value + 8));
          }
          if (placedItem.category === "plant") {
            setSiteHabits((current) => {
              const updated = current.map((habit) => habit.id === placedItem.habitId ? { ...habit, gardenPosition: position, updatedAt: new Date().toISOString() } : habit);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              void saveHabitSnapshot(updated);
              return updated;
            });
            sessionStorage.removeItem("rost-pending-plant");
            window.history.replaceState({}, "", "/garden-prototype");
          }
          setToast(`${pending.title} размещён именно в выбранном месте`);
          pendingRef.current = null;
          setPlacement(null);
        },
      }))
      .then((runtime) => {
        if (cancelled) runtime.dispose();
        else {
          runtimeRef.current = runtime;
          runtime.setTimeOfDay(timeFromDevice());
          runtime.setWeather(initialWeather());
          if (pendingHabit) {
            const pending: PendingPlacement = { item: habitItem(pendingHabit), title: pendingHabit.name, cost: 0 };
            pendingRef.current = pending;
            setPlacement(pending);
            runtime.beginPlacement(pending.item);
          }
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Игровой сад не запустился"));
    return () => {
      cancelled = true;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
    // Сцена создаётся один раз; изменения передаются в игровой движок отдельно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (focusHabit) runtimeRef.current?.setHabitGrowth(focusHabit.id, growth);
    else runtimeRef.current?.setGrowth(growth);
  }, [focusHabit, growth]);
  useEffect(() => () => {
    if (growthAnimationRef.current !== null) cancelAnimationFrame(growthAnimationRef.current);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const syncTime = () => {
      const next = timeFromDevice();
      setTimeOfDay(next);
      runtimeRef.current?.setTimeOfDay(next);
    };
    syncTime();
    const timer = window.setInterval(syncTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setWeather((current) => {
        const choices = (["sun", "cloud", "rain"] as GameWeather[]).filter((value) => value !== current);
        const next = choices[Math.floor(Math.random() * choices.length)];
        runtimeRef.current?.setWeather(next);
        return next;
      });
    }, 120_000);
    return () => window.clearInterval(timer);
  }, []);

  const touch = (x: number, z: number) => runtimeRef.current?.setTouchMove(x, z);
  const startPlacement = (next: PendingPlacement) => {
    if (stars < next.cost) {
      setToast("Пока не хватает звёзд — выполните ещё несколько действий");
      return;
    }
    pendingRef.current = next;
    setPlacement(next);
    setActivePanel(null);
    setDialog(null);
    runtimeRef.current?.beginPlacement(next.item);
  };
  const startHabitPlacement = () => {
    const name = habitName.trim();
    if (!name) {
      setToast("Сначала напишите название привычки");
      return;
    }
    startPlacement({
      item: {
        category: "plant",
        kind: selectedPlant,
        species: selectedPlant,
        habitId: `habit-${Date.now()}`,
        habitName: name,
        growth: 5,
        durationDays: habitDuration,
      },
      title: name,
      cost: 0,
    });
    setHabitName("");
  };
  const cancelPlacement = () => {
    runtimeRef.current?.cancelPlacement();
    pendingRef.current = null;
    setPlacement(null);
  };
  const changeGrowth = (value: number) => {
    if (growthAnimationRef.current !== null) cancelAnimationFrame(growthAnimationRef.current);
    growthAnimationRef.current = null;
    setGrowthDemo(false);
    setGrowth(value);
  };
  const demonstrateGrowth = () => {
    if (growthAnimationRef.current !== null) cancelAnimationFrame(growthAnimationRef.current);
    const start = performance.now();
    const duration = 7600;
    setGrowthDemo(true);
    setGrowth(5);
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      setGrowth(Math.round(5 + eased * 95));
      if (progress < 1) growthAnimationRef.current = requestAnimationFrame(tick);
      else {
        growthAnimationRef.current = null;
        setGrowthDemo(false);
        setToast("Так растение плавно проходит весь путь привычки");
      }
    };
    growthAnimationRef.current = requestAnimationFrame(tick);
  };

  return (
    <main className={styles.game}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Трёхмерный игровой сад, по которому можно ходить" />
      {!ready && !error && <div className={styles.loading}><span />Создаю игровое пространство…</div>}
      {error && <div className={styles.error}><strong>Сад не загрузился</strong><span>{error}</span></div>}

      <header className={styles.header}>
        <a href="/" className={styles.back} aria-label="Вернуться">←</a>
        <div><small>ЖИВОЙ 3D-САД</small><h1>Мой сад</h1></div>
        <div className={styles.score}>✦ <b>{stars}</b></div>
      </header>

      <section className={styles.habitCard}>
        <div className={styles.habitTitle}><div><small>ПРИВЫЧКА · {focusHabit ? durationDays(focusHabit) : 30} ДНЕЙ</small><strong>{focusHabit?.name ?? "Утренний стакан воды"}</strong></div><b>{growth}%</b></div>
        <input aria-label="Рост растения" type="range" min="5" max="100" value={growth} onChange={(event) => changeGrowth(Number(event.target.value))} />
        <div className={styles.growthActions}>
          <p>Растение растёт плавно все 30 дней — без переключения между картинками.</p>
          <button onClick={demonstrateGrowth} disabled={growthDemo}>{growthDemo ? "Растёт…" : "Показать рост"}</button>
        </div>
      </section>

      <section className={styles.weatherCard} aria-label="Автоматические время и погода в саду">
        <div className={styles.climateIcon}>{timeOfDay === "night" ? "☾" : timeOfDay === "evening" ? "◐" : weather === "rain" ? "☂" : weather === "cloud" ? "☁" : "☀"}</div>
        <div className={styles.weatherText}><b>{timeOfDay === "night" ? "Ночь" : timeOfDay === "evening" ? "Вечер" : "День"} · {WEATHER_COPY[weather].title}</b><small>{WEATHER_COPY[weather].text}</small></div>
        <div className={styles.autoClimate}><strong>АВТО</strong><span>время устройства · погода меняется сама</span></div>
      </section>

      <nav className={styles.toolButtons} aria-label="Инструменты сада">
        <a href="/?new=1"><span>♧</span>Новая привычка</a>
        <button className={activePanel === "shop" ? styles.activeTool : ""} onClick={() => setActivePanel((value) => value === "shop" ? null : "shop")}><span>✦</span>Магазин</button>
      </nav>

      {activePanel && <aside className={styles.workshop} aria-label={activePanel === "plant" ? "Выбор растения" : "Магазин сада"}>
        <button className={styles.panelClose} onClick={() => setActivePanel(null)} aria-label="Закрыть панель">×</button>
        <small>{activePanel === "plant" ? "СВОБОДНАЯ ПОСАДКА" : `БАЛАНС · ${stars} ЗВЁЗД`}</small>
        <h2>{activePanel === "plant" ? "Новая привычка" : "Что добавить?"}</h2>
        <p>{activePanel === "plant" ? "Настройте привычку, выберите её растение, а затем укажите место в саду." : "Выберите предмет, затем укажите точное место прямо на траве."}</p>
        {activePanel === "plant" ? <div className={styles.habitForm}>
          <label><span>Что за привычка?</span><input value={habitName} onChange={(event) => setHabitName(event.target.value)} placeholder="Например, вечерняя прогулка" /></label>
          <label><span>Сколько дней она растёт?</span><div className={styles.durationRow}><input type="number" min="7" max="365" value={habitDuration} onChange={(event) => setHabitDuration(Math.max(7, Math.min(365, Number(event.target.value))))} /><em>дней</em></div></label>
          <fieldset><legend>Какое растение посадить?</legend><div className={styles.workshopPlants}>
            {PLANTS.map((plant) => <button type="button" key={plant.kind} className={selectedPlant === plant.kind ? styles.selectedPlant : ""} aria-label={`Выбрать ${plant.title.toLowerCase()}`} onClick={() => setSelectedPlant(plant.kind)}><b>{plant.icon}</b><span>{plant.title}<small>{plant.text}</small></span></button>)}
          </div></fieldset>
          <button className={styles.primaryAction} onClick={startHabitPlacement}>Выбрать место в саду</button>
        </div> : <div className={styles.shopGrid}>
          {SHOP_ITEMS.map((item) => <button key={item.kind} aria-label={`Разместить ${item.title.toLowerCase()}`} onClick={() => startPlacement({ item: { category: "decoration", kind: item.kind }, title: item.title, cost: item.cost })} disabled={stars < item.cost}><b>{item.icon}</b><span><strong>{item.title}</strong><small>{item.text}</small></span><em>✦ {item.cost}</em></button>)}
        </div>}
      </aside>}

      {placement && <section className={styles.placementHint} role="status">
        <span>1</span><div><b>{placement.title}</b><small>Наведите на свободное место и нажмите. Красный силуэт означает, что место занято.</small></div><button onClick={cancelPlacement}>Отмена</button>
      </section>}

      <section className={styles.help}><b>WASD</b><span>гулять</span><b>мышь</b><span>поворачивать камеру</span><b>E</b><span>осмотреть</span></section>
      {nearby && !dialog && !placement && <button className={styles.prompt} onClick={() => runtimeRef.current?.interact()}><span>E</span><div><b>{nearby.title}</b><small>{nearby.text}</small></div></button>}
      {dialog && <section className={styles.dialog} aria-live="polite"><button className={styles.close} onClick={() => setDialog(null)} aria-label="Закрыть">×</button><small>ИССЛЕДОВАНИЕ</small><h2>{dialog.title}</h2><p>{dialog.text}</p>{dialog.kind === "plant" && <button className={styles.dialogAction} onClick={() => { setGrowth((value) => Math.min(100, value + 3)); setDialog(null); }}>Полить · +3% роста</button>}</section>}
      {toast && <div className={styles.toast} role="status">{toast}</div>}

      <nav className={styles.joystick} aria-label="Управление персонажем">
        <button aria-label="Вперёд" onPointerDown={() => touch(0, 1)} onPointerUp={() => touch(0, 0)} onPointerCancel={() => touch(0, 0)} onPointerLeave={() => touch(0, 0)}>↑</button>
        <button aria-label="Влево" onPointerDown={() => touch(-1, 0)} onPointerUp={() => touch(0, 0)} onPointerCancel={() => touch(0, 0)} onPointerLeave={() => touch(0, 0)}>←</button>
        <button aria-label="Назад" onPointerDown={() => touch(0, -1)} onPointerUp={() => touch(0, 0)} onPointerCancel={() => touch(0, 0)} onPointerLeave={() => touch(0, 0)}>↓</button>
        <button aria-label="Вправо" onPointerDown={() => touch(1, 0)} onPointerUp={() => touch(0, 0)} onPointerCancel={() => touch(0, 0)} onPointerLeave={() => touch(0, 0)}>→</button>
      </nav>
    </main>
  );
}

function expandNotice(notice: GameNotice, growth: number): GameNotice {
  if (!notice) return null;
  if (notice.kind === "plant") return { ...notice, text: `${notice.text}. Оно меняется только вместе со своей привычкой — прогресс других растений на него не влияет.` };
  return { ...notice, text: "Вода тихо движется у камней. Сад не торопит вас: одно выполненное дело сегодня уже поддерживает его жизнь." };
}

function timeFromDevice(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 18) return "day";
  if (hour >= 18 && hour < 21) return "evening";
  return "night";
}

function initialWeather(): GameWeather {
  const variants: GameWeather[] = ["sun", "sun", "cloud", "cloud", "rain"];
  const block = Math.floor(Date.now() / (15 * 60 * 1000));
  return variants[block % variants.length];
}
