"use client";

import { useEffect, useRef, useState } from "react";
import { loadBabylon } from "./garden3d/babylon";
import { createGardenGame, type GameNotice, type GardenGameRuntime } from "./garden3d/game";
import styles from "./garden-prototype/garden-3d-prototype.module.css";

export default function Garden3DPrototype() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GardenGameRuntime | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [growth, setGrowth] = useState(34);
  const [nearby, setNearby] = useState<GameNotice>(null);
  const [dialog, setDialog] = useState<GameNotice>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    loadBabylon()
      .then((B) => createGardenGame(B, canvas, {
        growth,
        onReady: () => { if (!cancelled) setReady(true); },
        onNearby: (notice) => { if (!cancelled) setNearby(notice); },
        onInteract: (notice) => { if (!cancelled) setDialog(expandNotice(notice, growth)); },
      }))
      .then((runtime) => {
        if (cancelled) runtime.dispose();
        else runtimeRef.current = runtime;
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Игровой сад не запустился"));
    return () => {
      cancelled = true;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
    // Сцена создаётся один раз, а рост обновляется отдельным эффектом.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => runtimeRef.current?.setGrowth(growth), [growth]);

  const touch = (x: number, z: number) => runtimeRef.current?.setTouchMove(x, z);

  return (
    <main className={styles.game}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Трёхмерный игровой сад, по которому можно ходить" />
      {!ready && !error && <div className={styles.loading}><span />Создаю игровое пространство…</div>}
      {error && <div className={styles.error}><strong>Сад не загрузился</strong><span>{error}</span></div>}

      <header className={styles.header}>
        <a href="/" className={styles.back} aria-label="Вернуться">←</a>
        <div><small>ИГРОВОЙ ФРАГМЕНТ · ЖИВОЕ 3D</small><h1>Мой сад</h1></div>
        <div className={styles.score}>✦ <b>46</b></div>
      </header>

      <section className={styles.habitCard}>
        <div className={styles.habitTitle}><div><small>ПРИВЫЧКА · 30 ДНЕЙ</small><strong>Утренний стакан воды</strong></div><b>{growth}%</b></div>
        <input aria-label="Рост растения" type="range" min="5" max="100" value={growth} onChange={(event) => setGrowth(Number(event.target.value))} />
        <p>Подойдите к растению слева от дорожки и осмотрите его.</p>
      </section>

      <section className={styles.help}>
        <b>WASD</b><span>идти</span><b>мышь</b><span>осмотреться</span><b>E</b><span>взаимодействовать</span>
      </section>

      {nearby && !dialog && <button className={styles.prompt} onClick={() => runtimeRef.current?.interact()}>
        <span>E</span><div><b>{nearby.title}</b><small>{nearby.text}</small></div>
      </button>}

      {dialog && <section className={styles.dialog} aria-live="polite">
        <button className={styles.close} onClick={() => setDialog(null)} aria-label="Закрыть">×</button>
        <small>{dialog.kind === "npc" ? "РАЗГОВОР" : "ИССЛЕДОВАНИЕ"}</small>
        <h2>{dialog.title}</h2>
        <p>{dialog.text}</p>
        {dialog.kind === "npc" && <button className={styles.dialogAction} onClick={() => setDialog(null)}>Спасибо, Мира</button>}
        {dialog.kind === "plant" && <button className={styles.dialogAction} onClick={() => { setGrowth((value) => Math.min(100, value + 3)); setDialog(null); }}>Полить · +3% роста</button>}
      </section>}

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
  if (notice.kind === "npc") return { ...notice, text: "Рада тебя видеть. Здесь каждая привычка получает своё место. Не торопись: пройдись, послушай воду и позаботься о молодом дереве." };
  if (notice.kind === "plant") return { ...notice, text: `Это растение связано с привычкой «Утренний стакан воды». Сейчас оно прошло ${growth}% пути. Сегодня ему достаточно одного небольшого действия.` };
  return { ...notice, text: "Вода тихо движется у камней. Иногда полезно остановиться на несколько секунд и просто выдохнуть." };
}
