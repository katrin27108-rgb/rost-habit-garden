"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import styles from "./garden-prototype/prototype.module.css";
import { loadGardenResources, type GardenResources } from "./garden/resources";
import { clamp, projectPoint, sceneZoom, updateCamera, updateWalker } from "./garden/camera";
import { drawEnvironment } from "./garden/environment";
import { drawPrototypePlant, drawWalker } from "./garden/plants/render";
import {
  HEALTH_VALUES,
  SPECIES_LABELS,
  WEATHER_LABELS,
  type GardenCamera,
  type GardenWalker,
  type PrototypeHealth,
  type PrototypeQuality,
  type PrototypeSpecies,
  type PrototypeWeather,
} from "./garden/types";

const GROWTH_PRESETS = [5, 20, 35, 50, 70, 85, 100];
const HEALTH_LABELS: Record<PrototypeHealth, string> = {
  healthy: "Здоровое",
  drooping: "Слегка поникшее",
  wilted: "Заметно увядшее",
  sleeping: "Спящее",
};

export default function GardenPrototype() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [resources, setResources] = useState<GardenResources>();
  const [loadError, setLoadError] = useState("");
  const [species, setSpecies] = useState<PrototypeSpecies>("oak");
  const [growth, setGrowth] = useState(70);
  const [health, setHealth] = useState<PrototypeHealth>("healthy");
  const [weather, setWeather] = useState<PrototypeWeather>("clear");
  const [quality, setQuality] = useState<PrototypeQuality>("full");
  const [exploring, setExploring] = useState(false);
  const stateRef = useRef({ species, growth, health, weather, quality, exploring });
  const cameraRef = useRef<GardenCamera>({ x: 0, y: 35 });
  const walkerRef = useRef<GardenWalker>({ x: 0, y: 245 });
  const targetRef = useRef<GardenWalker | null>(null);
  const keysRef = useRef(new Set<string>());
  const displayedHealthRef = useRef(1);

  useEffect(() => { stateRef.current = { species, growth, health, weather, quality, exploring }; }, [species, growth, health, weather, quality, exploring]);
  useEffect(() => { loadGardenResources().then(setResources).catch((error) => setLoadError(String(error))); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !resources) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let animation = 0;
    let lastTime = performance.now();
    let lastReducedFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(width < 600 ? 1.5 : 2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!stateRef.current.exploring || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(event.key)) return;
      event.preventDefault();
      keysRef.current.add(event.key.toLowerCase());
      targetRef.current = null;
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    const draw = (time: number) => {
      const dt = Math.min(48, time - lastTime);
      lastTime = time;
      const state = stateRef.current;
      if (reducedMotion && time - lastReducedFrame < 120) {
        animation = requestAnimationFrame(draw);
        return;
      }
      lastReducedFrame = time;

      const keys = keysRef.current;
      const direction = {
        x: (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0),
        y: (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0),
      };
      const moving = state.exploring ? updateWalker(walkerRef.current, targetRef.current, direction, dt) : false;
      if (targetRef.current && Math.hypot(targetRef.current.x - walkerRef.current.x, targetRef.current.y - walkerRef.current.y) < 9) targetRef.current = null;
      updateCamera(cameraRef.current, walkerRef.current, dt, state.exploring);
      displayedHealthRef.current += (HEALTH_VALUES[state.health] - displayedHealthRef.current) * (1 - Math.exp(-dt * .0024));

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      drawEnvironment({ context, image: resources.environment, width, height, camera: cameraRef.current, weather: state.weather, quality: state.quality, time, reducedMotion });

      const zoom = sceneZoom(width, state.exploring);
      const selectedProgress = state.growth / 100;
      const selectedHealth = displayedHealthRef.current;
      const plants = [
        { species: "willow" as const, x: -72, y: -38, progress: state.species === "willow" ? selectedProgress : .96, health: state.species === "willow" ? selectedHealth : .96 },
        { species: "oak" as const, x: 205, y: 20, progress: state.species === "oak" ? selectedProgress : .94, health: state.species === "oak" ? selectedHealth : .97 },
        { species: "lavender" as const, x: 12, y: 205, progress: state.species === "lavender" ? selectedProgress : 1, health: state.species === "lavender" ? selectedHealth : .98 },
      ].sort((a, b) => a.y - b.y);

      for (const plant of plants) {
        const point = projectPoint(plant.x, plant.y, width, height, zoom, cameraRef.current);
        if (point.x < -280 || point.x > width + 280 || point.y < -380 || point.y > height + 80) continue;
        drawPrototypePlant({ context, plant, screenX: point.x, screenY: point.y, zoom: zoom * (width < 560 ? .88 : .72), time, quality: state.quality, reducedMotion, textures: resources });
      }

      if (state.exploring) {
        const point = projectPoint(walkerRef.current.x, walkerRef.current.y, width, height, zoom, cameraRef.current);
        drawWalker(context, point.x, point.y, Math.max(.72, zoom * .76), time, moving, reducedMotion);
      }

      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animation);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [resources]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!exploring) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const zoom = sceneZoom(rect.width, true);
    const next = {
      x: cameraRef.current.x + (event.clientX - rect.left - rect.width / 2) / zoom,
      y: cameraRef.current.y + (event.clientY - rect.top - rect.height * .64) / (zoom * .54),
    };
    targetRef.current = { x: clamp(next.x, -650, 650), y: clamp(next.y, -190, 390) };
  };

  const setDirection = (direction: string, pressed: boolean) => {
    if (pressed) {
      keysRef.current.add(direction);
      targetRef.current = null;
    } else keysRef.current.delete(direction);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p>Художественный прототип · не опубликован</p><h1>Новый живой сад</h1></div>
        <a href="/">← Вернуться в приложение</a>
      </header>

      <section className={styles.stage} aria-label="Прототип новой сцены сада">
        <canvas ref={canvasRef} onPointerDown={handlePointerDown} tabIndex={exploring ? 0 : -1} aria-label="Живописный сад с дубом, ивой и лавандой" />
        {!resources && !loadError && <div className={styles.loading}>Проявляю сад…</div>}
        {loadError && <div className={styles.loading}>Не удалось открыть художественный ресурс.</div>}
        <div className={styles.sceneBadge}><i /> {WEATHER_LABELS[weather]} · {quality === "full" ? "полная графика" : "лёгкая графика"}</div>
        <div className={styles.sceneCaption}>
          <span>{exploring ? "Прогулка" : "Художественная сцена"}</span>
          <strong>{SPECIES_LABELS[species]} · рост {growth}%</strong>
          <small>{HEALTH_LABELS[health]}. Изменения здоровья восстанавливаются постепенно.</small>
        </div>
        <button className={styles.walkToggle} onClick={() => setExploring((value) => !value)}>{exploring ? "Выйти из прогулки" : "Войти в сад"}</button>
        {exploring && <>
          <div className={styles.walkHint}>Нажми на землю или используй WASD / стрелки</div>
          <div className={styles.joystick} aria-label="Управление прогулкой">
            <button aria-label="Вверх" onPointerDown={() => setDirection("arrowup", true)} onPointerUp={() => setDirection("arrowup", false)} onPointerLeave={() => setDirection("arrowup", false)}>↑</button>
            <button aria-label="Влево" onPointerDown={() => setDirection("arrowleft", true)} onPointerUp={() => setDirection("arrowleft", false)} onPointerLeave={() => setDirection("arrowleft", false)}>←</button>
            <button aria-label="Вниз" onPointerDown={() => setDirection("arrowdown", true)} onPointerUp={() => setDirection("arrowdown", false)} onPointerLeave={() => setDirection("arrowdown", false)}>↓</button>
            <button aria-label="Вправо" onPointerDown={() => setDirection("arrowright", true)} onPointerUp={() => setDirection("arrowright", false)} onPointerLeave={() => setDirection("arrowright", false)}>→</button>
          </div>
        </>}
      </section>

      <section className={styles.controls} aria-label="Демонстрация состояний сада">
        <ControlGroup title="Показательное растение" note="Три разные конструкции">
          <div className={styles.segmented}>{(["oak", "willow", "lavender"] as PrototypeSpecies[]).map((value) => <button key={value} className={species === value ? styles.active : ""} onClick={() => setSpecies(value)}>{SPECIES_LABELS[value]}</button>)}</div>
        </ControlGroup>
        <ControlGroup title="Непрерывный рост" note={`${growth}%`}>
          <input className={styles.range} type="range" min="1" max="100" value={growth} onChange={(event) => setGrowth(Number(event.target.value))} aria-label="Процент роста" />
          <div className={styles.presets}>{GROWTH_PRESETS.map((value) => <button key={value} className={growth === value ? styles.active : ""} onClick={() => setGrowth(value)}>{value}%</button>)}</div>
        </ControlGroup>
        <ControlGroup title="Здоровье" note="Рост не уменьшается">
          <div className={styles.healthGrid}>{(Object.keys(HEALTH_LABELS) as PrototypeHealth[]).map((value) => <button key={value} className={health === value ? styles.active : ""} onClick={() => setHealth(value)}>{HEALTH_LABELS[value]}</button>)}</div>
        </ControlGroup>
        <ControlGroup title="Погода" note="Меняется вся сцена">
          <div className={styles.segmented}>{(["clear", "overcast", "rain"] as PrototypeWeather[]).map((value) => <button key={value} className={weather === value ? styles.active : ""} onClick={() => setWeather(value)}>{WEATHER_LABELS[value]}</button>)}</div>
        </ControlGroup>
        <ControlGroup title="Производительность" note="Художественный стиль сохраняется">
          <div className={styles.segmented}>{(["full", "light"] as PrototypeQuality[]).map((value) => <button key={value} className={quality === value ? styles.active : ""} onClick={() => setQuality(value)}>{value === "full" ? "Полная" : "Облегчённая"}</button>)}</div>
        </ControlGroup>
      </section>
    </main>
  );
}

function ControlGroup({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return <article className={styles.controlGroup}><div><strong>{title}</strong><span>{note}</span></div>{children}</article>;
}
