"use client";

import { useEffect, useRef, useState } from "react";
import { loadBabylon } from "./garden3d/babylon";
import { createGardenScene, type GardenRuntime } from "./garden3d/scene";
import type { GardenHealth, GardenQuality, GardenState, GardenView, GardenWeather } from "./garden3d/types";
import styles from "./garden-prototype/garden-3d-prototype.module.css";

const GROWTH_POINTS = [5, 20, 35, 50, 70, 85, 100];
const HEALTH_LABELS: Record<GardenHealth, string> = {
  healthy: "Здоровое",
  drooping: "Поникшее",
  wilted: "Увядшее",
  sleeping: "Спящее",
};
const WEATHER_LABELS: Record<GardenWeather, string> = {
  clear: "Солнце",
  overcast: "Облака",
  rain: "Дождь",
};

export default function Garden3DPrototype() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GardenRuntime | null>(null);
  const moveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [growth, setGrowth] = useState(70);
  const [health, setHealth] = useState<GardenHealth>("healthy");
  const [weather, setWeather] = useState<GardenWeather>("clear");
  const [quality, setQuality] = useState<GardenQuality>("full");
  const [view, setView] = useState<GardenView>("overview");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const stateRef = useRef<GardenState>({ growth, health, weather, quality, view });
  stateRef.current = { growth, health, weather, quality, view };

  useEffect(() => {
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    loadBabylon()
      .then((B) => {
        if (cancelled || !canvasRef.current) return;
        runtimeRef.current = createGardenScene(B, canvasRef.current, stateRef, reducedMotion);
        setReady(true);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "3D-сцена не запустилась"));
    return () => {
      cancelled = true;
      runtimeRef.current?.dispose();
      if (moveTimer.current) clearInterval(moveTimer.current);
    };
  }, []);

  const changeQuality = (value: GardenQuality) => {
    setQuality(value);
    runtimeRef.current?.engine.setHardwareScalingLevel(value === "light" ? 1.5 : Math.min(1.25, 1 / window.devicePixelRatio));
  };

  const startMoving = (x: number, z: number) => {
    runtimeRef.current?.cameras.moveWalk(x, z);
    if (moveTimer.current) clearInterval(moveTimer.current);
    moveTimer.current = setInterval(() => runtimeRef.current?.cameras.moveWalk(x, z), 45);
  };
  const stopMoving = () => {
    if (moveTimer.current) clearInterval(moveTimer.current);
    moveTimer.current = null;
  };

  return (
    <main className={styles.prototype}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Интерактивный трёхмерный сад с растущим дубом" />
      {!ready && !error && <div className={styles.loading}><span />Проращиваю настоящий 3D-сад…</div>}
      {error && <div className={styles.error}>{error}</div>}

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ИССЛЕДОВАТЕЛЬСКИЙ 3D-ПРОТОТИП · НЕ ОПУБЛИКОВАН</span>
          <h1>Сад, который растёт вместе с привычкой</h1>
        </div>
        <a href="/" className={styles.back}>Вернуться</a>
      </header>

      <section className={styles.habitCard}>
        <span className={styles.seedMark}>01</span>
        <div><small>ПРИВЫЧКА · 30 ДНЕЙ</small><strong>Утренний стакан воды</strong></div>
        <div className={styles.progressRing} style={{ "--progress": `${growth * 3.6}deg` } as React.CSSProperties}><span>{growth}%</span></div>
      </section>

      <aside className={styles.controls} aria-label="Настройки демонстрации сада">
        <Control title="Непрерывный рост" value={`${growth}%`}>
          <input aria-label="Процент роста дуба" type="range" min="1" max="100" value={growth} onChange={(event) => setGrowth(Number(event.target.value))} />
          <div className={styles.growthPoints}>{GROWTH_POINTS.map((point) => <button key={point} className={growth === point ? styles.active : ""} onClick={() => setGrowth(point)}>{point}</button>)}</div>
        </Control>
        <Control title="Состояние" value={HEALTH_LABELS[health]}>
          <div className={styles.buttonGrid}>{(Object.keys(HEALTH_LABELS) as GardenHealth[]).map((value) => <button key={value} className={health === value ? styles.active : ""} onClick={() => setHealth(value)}>{HEALTH_LABELS[value]}</button>)}</div>
        </Control>
        <Control title="Погода" value={WEATHER_LABELS[weather]}>
          <div className={styles.segmented}>{(Object.keys(WEATHER_LABELS) as GardenWeather[]).map((value) => <button key={value} className={weather === value ? styles.active : ""} onClick={() => setWeather(value)}>{WEATHER_LABELS[value]}</button>)}</div>
        </Control>
        <div className={styles.footerControls}>
          <div className={styles.segmented}>{(["full", "light"] as GardenQuality[]).map((value) => <button key={value} className={quality === value ? styles.active : ""} onClick={() => changeQuality(value)}>{value === "full" ? "Полная" : "Лёгкая"}</button>)}</div>
          <button className={styles.enter} onClick={() => setView(view === "overview" ? "walk" : "overview")}>{view === "overview" ? "Войти в сад" : "Общий вид"}</button>
        </div>
      </aside>

      <div className={styles.sceneHint}>{view === "overview" ? "Потяните, чтобы осмотреть сад · колёсико меняет масштаб" : "WASD или кнопки · потяните, чтобы посмотреть вокруг"}</div>

      {view === "walk" && <nav className={styles.joystick} aria-label="Управление прогулкой">
        <button aria-label="Вперёд" onPointerDown={() => startMoving(0, 1)} onPointerUp={stopMoving} onPointerLeave={stopMoving}>↑</button>
        <button aria-label="Влево" onPointerDown={() => startMoving(-1, 0)} onPointerUp={stopMoving} onPointerLeave={stopMoving}>←</button>
        <button aria-label="Назад" onPointerDown={() => startMoving(0, -1)} onPointerUp={stopMoving} onPointerLeave={stopMoving}>↓</button>
        <button aria-label="Вправо" onPointerDown={() => startMoving(1, 0)} onPointerUp={stopMoving} onPointerLeave={stopMoving}>→</button>
      </nav>}
    </main>
  );
}

function Control({ title, value, children }: { title: string; value: string; children: React.ReactNode }) {
  return <div className={styles.control}><div className={styles.controlTitle}><strong>{title}</strong><span>{value}</span></div>{children}</div>;
}
