"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./garden-prototype/garden-3d-prototype.module.css";

type Weather = "sun" | "cloud" | "rain";
type View = "overview" | "walk";

const weatherNames: Record<Weather, string> = {
  sun: "Солнечно",
  cloud: "Облачно",
  rain: "Тёплый дождь",
};

const encouragement = [
  "Одно выполненное дело — уже настоящий вклад в твой сад.",
  "Не нужно идеально. Даже маленький шаг сегодня поддерживает рост.",
  "Я горжусь тобой: ты снова выбрала позаботиться о себе.",
  "Твой ритм становится крепче. Продолжай бережно, без спешки.",
];

export default function Garden3DPrototype() {
  const [growth, setGrowth] = useState(34);
  const [weather, setWeather] = useState<Weather>("sun");
  const [view, setView] = useState<View>("overview");
  const [completed, setCompleted] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("rost-garden-art-v2");
    if (!stored) return;
    try {
      const saved = JSON.parse(stored) as { growth?: number; completed?: boolean };
      if (typeof saved.growth === "number") setGrowth(saved.growth);
      if (typeof saved.completed === "boolean") setCompleted(saved.completed);
    } catch {
      // Повреждённые локальные данные не мешают открыть сад.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("rost-garden-art-v2", JSON.stringify({ growth, completed }));
  }, [growth, completed]);

  const message = useMemo(() => encouragement[(growth + (completed ? 1 : 0)) % encouragement.length], [growth, completed]);
  const phase = growth < 12 ? "Семя отдыхает в земле" : growth < 32 ? "Появился первый росток" : growth < 65 ? "Молодое дерево крепнет" : growth < 90 ? "Крона становится гуще" : "Дерево почти взрослое";

  const toggleDone = () => {
    setCompleted((current) => {
      const next = !current;
      setGrowth((value) => Math.max(1, Math.min(100, value + (next ? 3 : -3))));
      return next;
    });
  };

  const move = (dx: number, dy: number) => setOffset((value) => ({
    x: Math.max(-13, Math.min(13, value.x + dx)),
    y: Math.max(-7, Math.min(7, value.y + dy)),
  }));

  return (
    <main className={`${styles.garden} ${styles[weather]} ${view === "walk" ? styles.walk : ""}`}>
      <div
        className={styles.world}
        onPointerDown={(event) => {
          if (view !== "walk") return;
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setOffset({
            x: Math.max(-13, Math.min(13, drag.current.ox + (event.clientX - drag.current.x) / 35)),
            y: Math.max(-7, Math.min(7, drag.current.oy + (event.clientY - drag.current.y) / 45)),
          });
        }}
        onPointerUp={() => { drag.current = null; }}
      >
        <img
          className={styles.master}
          src="/garden-v2/open-garden-master.png"
          alt="Открытый сад с дорожками, свободными клумбами, молодым деревом, прудом и светлой беседкой"
          style={{ transform: `translate3d(${offset.x}%, ${offset.y}%, 0) scale(${view === "walk" ? 1.24 : 1.06})` }}
        />
        <div className={styles.sunbeams} />
        <div className={styles.cloudVeil} />
        <div className={styles.rainfall} aria-hidden="true" />
        <div className={styles.pondLight} aria-hidden="true" />
        <div className={styles.motes} aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}
        </div>

        <button className={`${styles.plot} ${styles.plotOak} ${selectedPlot === 0 ? styles.selected : ""}`} onClick={() => setSelectedPlot(0)} aria-label="Открыть привычку Утренний стакан воды">
          <span className={styles.plotPulse} />
          <span className={styles.plotLabel}><b>{growth}%</b>Дуб · вода</span>
        </button>
        <button className={`${styles.plot} ${styles.plotStretch} ${selectedPlot === 1 ? styles.selected : ""}`} onClick={() => setSelectedPlot(1)} aria-label="Открыть свободное место для привычки">
          <span className={styles.emptyPlot}>＋</span><span className={styles.plotLabel}>Новая посадка</span>
        </button>
        <button className={`${styles.plot} ${styles.plotRead} ${selectedPlot === 2 ? styles.selected : ""}`} onClick={() => setSelectedPlot(2)} aria-label="Открыть свободное место для привычки">
          <span className={styles.emptyPlot}>＋</span><span className={styles.plotLabel}>Новая посадка</span>
        </button>
      </div>

      <header className={styles.header}>
        <a className={styles.back} href="/" aria-label="Вернуться на главную">←</a>
        <div><span>СУББОТА · 18 ИЮЛЯ</span><h1>Мой сад</h1></div>
        <div className={styles.stats}><span>✦ <b>46</b></span><span>Лучший ритм <b>8 дней</b></span></div>
      </header>

      <section className={styles.support} aria-live="polite">
        <span className={styles.supportIcon}>✦</span>
        <div><small>ТЁПЛОЕ НАПОМИНАНИЕ</small><p>{message}</p></div>
      </section>

      <section className={`${styles.habit} ${selectedPlot !== 0 ? styles.newHabit : ""}`}>
        {selectedPlot === 0 ? <>
          <div className={styles.habitTop}><div><small>ПРИВЫЧКА · 30 ДНЕЙ</small><h2>Утренний стакан воды</h2></div><div className={styles.ring} style={{ "--growth": `${growth * 3.6}deg` } as React.CSSProperties}><span>{growth}%</span></div></div>
          <div className={styles.phase}><span style={{ width: `${growth}%` }} /><b>{phase}</b></div>
          <input aria-label="Посмотреть рост привычки" type="range" min="1" max="100" value={growth} onChange={(event) => setGrowth(Number(event.target.value))} />
          <button className={`${styles.done} ${completed ? styles.isDone : ""}`} onClick={toggleDone}>{completed ? "✓ Сегодня выполнено" : "Отметить выполненным"}</button>
        </> : <>
          <div className={styles.emptyCopy}><span>Свободная клумба</span><h2>Посадить новую привычку</h2><p>Каждая привычка станет отдельным растением и будет расти в своём ритме.</p></div>
          <button className={styles.done}>＋ Создать привычку</button>
        </>}
      </section>

      <nav className={styles.toolbar} aria-label="Управление садом">
        <div className={styles.weatherButtons}>{(["sun", "cloud", "rain"] as Weather[]).map((value) => <button key={value} className={weather === value ? styles.active : ""} onClick={() => setWeather(value)} aria-label={weatherNames[value]}>{value === "sun" ? "☀" : value === "cloud" ? "☁" : "☂"}</button>)}</div>
        <button className={styles.enter} onClick={() => { setView((value) => value === "overview" ? "walk" : "overview"); setOffset({ x: 0, y: 0 }); }}>{view === "overview" ? "Войти в сад" : "Выйти к обзору"}</button>
      </nav>

      {view === "walk" && <div className={styles.walkControls}>
        <p>Перетаскивайте сад или используйте стрелки</p>
        <div><button onClick={() => move(0, 3)}>↑</button><button onClick={() => move(3, 0)}>←</button><button onClick={() => move(0, -3)}>↓</button><button onClick={() => move(-3, 0)}>→</button></div>
      </div>}
    </main>
  );
}
