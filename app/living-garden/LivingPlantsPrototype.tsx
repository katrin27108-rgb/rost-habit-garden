"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState, type CSSProperties } from "react";
import styles from "./living-garden.module.css";

type SpeciesCode = "sunflower" | "tomato" | "lavender" | "monstera";
type CareEffect = "grow" | "fertilizer" | "kind";

type Species = {
  code: SpeciesCode;
  name: string;
  character: string;
  accent: string;
};

type PlantHabit = {
  id: string;
  habit: string;
  species: SpeciesCode;
  completedDays: number;
  durationDays: number;
};

const species: Species[] = [
  { code: "sunflower", name: "Подсолнух", character: "Солнечный и смелый", accent: "#e1a82e" },
  { code: "tomato", name: "Томат черри", character: "Щедрый и бодрый", accent: "#d76a4d" },
  { code: "lavender", name: "Лаванда", character: "Спокойная и нежная", accent: "#8d78ad" },
  { code: "monstera", name: "Монстера", character: "Уверенная и стойкая", accent: "#548468" },
];

const initialPlants: PlantHabit[] = [
  { id: "walk", habit: "Гулять 30 минут", species: "sunflower", completedDays: 11, durationDays: 30 },
  { id: "read", habit: "Читать перед сном", species: "lavender", completedDays: 7, durationDays: 30 },
  { id: "water", habit: "Пить достаточно воды", species: "monstera", completedDays: 22, durationDays: 30 },
];

const defaultMessages: Record<SpeciesCode, string> = {
  sunflower: "Я уже тянусь к свету. Один твой шаг — и у меня появится новый лист.",
  tomato: "Забота копится незаметно, а потом превращается в настоящее цветение.",
  lavender: "Можно расти тихо. Маленький ритм всё равно становится силой.",
  monstera: "Посмотри, сколько пути уже пройдено. Мы оба стали крепче.",
};

const careMessages = {
  grow: "Спасибо! Сегодня у меня появился новый кусочек жизни. И ты тоже выросла.",
  fertilizer: "Как приятно! Цветок ожил — настоящий рост всё равно принесёт твой следующий шаг.",
  kind: "Я тебя услышало. Будем расти не спеша — столько, сколько нужно.",
};

function getSpecies(code: SpeciesCode) {
  return species.find((item) => item.code === code) ?? species[0];
}

function growthStage(plant: PlantHabit) {
  return Math.min(4, Math.floor((plant.completedDays / plant.durationDays) * 5));
}

function growthProgress(plant: PlantHabit) {
  return Math.min(1, Math.max(0, plant.completedDays / plant.durationDays));
}

function stageName(stage: number) {
  return ["Семечко", "Первые листья", "Молодое растение", "Скоро цветение", "Взрослое растение"][stage];
}

function progressFor(plant: PlantHabit) {
  return Math.round((plant.completedDays / plant.durationDays) * 100);
}

function PlantArt({ plant, effect, className = "" }: { plant: PlantHabit; effect?: CareEffect; className?: string }) {
  const plantSpecies = getSpecies(plant.species);
  const stage = growthStage(plant);
  const progress = growthProgress(plant);
  const dailyGrowth = 1 / plant.durationDays;
  const scale = 0.12 + Math.pow(progress, 0.7) * 0.88;
  const previousScale = 0.12 + Math.pow(Math.max(0, progress - dailyGrowth), 0.7) * 0.88;
  return (
    <div
      className={`${styles.plantArt} ${effect ? styles[effect] : ""} ${className}`}
      style={{
        "--accent": plantSpecies.accent,
        "--plant-scale": scale,
        "--plant-previous-scale": previousScale,
      } as CSSProperties}
      role="img"
      aria-label={`${plantSpecies.name}, стадия: ${stageName(stage)}`}
    >
      <span className={styles.seedGlow} aria-hidden="true" />
      <Image className={styles.plantImage} src={`/plants/${plant.species}.webp`} alt="" width={1024} height={1536} unoptimized />
      {effect === "fertilizer" && <span className={styles.fertilizerDust} aria-hidden="true">✦ ✧ ✦</span>}
      {effect === "kind" && <span className={styles.kindHearts} aria-hidden="true">♡  ♡  ♡</span>}
      {effect === "grow" && <span className={styles.growthLeaves} aria-hidden="true">✦</span>}
    </div>
  );
}

export default function LivingPlantsPrototype() {
  const [plants, setPlants] = useState(initialPlants);
  const [selectedId, setSelectedId] = useState(initialPlants[0].id);
  const [todayChecks, setTodayChecks] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [effect, setEffect] = useState<{ plantId: string; kind: CareEffect } | null>(null);
  const [showPlanting, setShowPlanting] = useState(false);
  const [newHabit, setNewHabit] = useState("Вечерняя растяжка");
  const [newSpecies, setNewSpecies] = useState<SpeciesCode>("tomato");
  const [newDuration, setNewDuration] = useState(30);

  const selected = plants.find((plant) => plant.id === selectedId) ?? plants[0];
  const selectedSpecies = getSpecies(selected.species);
  const selectedProgress = progressFor(selected);
  const selectedStage = growthStage(selected);
  const totalDays = plants.reduce((sum, plant) => sum + plant.completedDays, 0);
  const averageProgress = Math.round(plants.reduce((sum, plant) => sum + progressFor(plant), 0) / plants.length);
  const finishedToday = plants.filter((plant) => todayChecks[plant.id]).length;
  const stageWidth = `${(selectedStage / 4) * 100}%`;

  function showCareEffect(plantId: string, kind: CareEffect) {
    setEffect({ plantId, kind });
    window.setTimeout(() => setEffect((current) => current?.plantId === plantId && current.kind === kind ? null : current), 1800);
  }

  function completePlant(plantId: string) {
    const plant = plants.find((item) => item.id === plantId);
    if (!plant) return;
    setSelectedId(plantId);
    if (todayChecks[plantId] || plant.completedDays >= plant.durationDays) return;
    setPlants((current) => current.map((item) => item.id === plantId
      ? { ...item, completedDays: Math.min(item.durationDays, item.completedDays + 1) }
      : item));
    setTodayChecks((current) => ({ ...current, [plantId]: true }));
    setMessages((current) => ({ ...current, [plantId]: careMessages.grow }));
    showCareEffect(plantId, "grow");
  }

  function sayKindWord() {
    setMessages((current) => ({ ...current, [selected.id]: careMessages.kind }));
    showCareEffect(selected.id, "kind");
  }

  function nourish() {
    setMessages((current) => ({ ...current, [selected.id]: careMessages.fertilizer }));
    showCareEffect(selected.id, "fertilizer");
  }

  function plantNewHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    const plant: PlantHabit = {
      id: `plant-${Date.now()}`,
      habit: name,
      species: newSpecies,
      completedDays: 0,
      durationDays: newDuration,
    };
    setPlants((current) => [...current, plant]);
    setSelectedId(plant.id);
    setMessages((current) => ({ ...current, [plant.id]: "Мы только познакомились. Твой первый шаг разбудит моё семечко." }));
    setShowPlanting(false);
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true"><i /><i /><i /></div>

      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Вернуться в основной сад">
          <span className={styles.brandMark}>р</span>
          <span><strong>РОСТ</strong><small>живая оранжерея · пробная версия</small></span>
        </Link>
        <nav className={styles.nav} aria-label="Навигация оранжереи">
          <a href="#plants">Мои растения</a>
          <span>Сегодня: <b>{finishedToday} / {plants.length}</b></span>
          <Link className={styles.backLink} href="/garden-prototype">Сравнить с 3D</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>ПЯТНИЦА · ДЕНЬ, КОТОРЫЙ МОЖНО ВЫРАСТИТЬ</p>
          <h1>Твоя привычка<br />становится <em>живой</em></h1>
          <p className={styles.lead}>Нажми на растение, когда выполнила действие. Оно отметит твой день, покажет рост и ответит маленьким живым жестом.</p>
          <div className={styles.heroStats}>
            <div><strong>{plants.length}</strong><span>живых растения</span></div>
            <div><strong>{totalDays}</strong><span>дней заботы</span></div>
            <div><strong>{averageProgress}%</strong><span>средний рост</span></div>
          </div>
        </div>

        <article className={`${styles.featured} ${effect?.plantId === selected.id ? styles.celebrating : ""}`} style={{ "--accent": selectedSpecies.accent } as CSSProperties}>
          <div className={styles.featuredHeading}><span>{selectedSpecies.name} · {stageName(selectedStage)}</span><b>{selectedProgress}%</b></div>
          <h2>{selected.habit}</h2>
          <div className={styles.speech} aria-live="polite"><span>“</span>{messages[selected.id] ?? defaultMessages[selected.species]}</div>
          <button className={styles.plantButton} onClick={() => completePlant(selected.id)} disabled={todayChecks[selected.id] || selected.completedDays >= selected.durationDays} aria-label={`Отметить: ${selected.habit}`}>
            <PlantArt plant={selected} effect={effect?.plantId === selected.id ? effect.kind : undefined} />
            <span className={styles.tapHint}>{todayChecks[selected.id] ? "Сегодня уже отмечено" : "Нажми на растение — подтвердить день"}</span>
          </button>
          <div className={styles.featuredFooter}><span>День {selected.completedDays} из {selected.durationDays}</span><strong>{selectedStage === 4 ? "Взрослое растение" : `До следующей стадии ${Math.max(1, Math.ceil(selected.durationDays / 5) - (selected.completedDays % Math.ceil(selected.durationDays / 5)))} дн.`}</strong></div>
          <div className={styles.progressTrack}><i style={{ width: `${selectedProgress}%` }} /></div>
        </article>
      </section>

      <section className={styles.ritual} aria-label="Действия с выбранным растением">
        <div className={styles.ritualIntro}><span className={styles.eyebrow}>ЗАБОТА СЕГОДНЯ</span><strong>У растения тоже есть настроение</strong><small>Прогресс даёт только выполненная привычка. Остальное — тёплые жесты.</small></div>
        <button className={styles.primaryAction} onClick={() => completePlant(selected.id)} disabled={todayChecks[selected.id] || selected.completedDays >= selected.durationDays}><span>{todayChecks[selected.id] ? "✓" : "＋"}</span><b>{todayChecks[selected.id] ? "День подтверждён" : "Подтвердить выполнение"}</b><small>{todayChecks[selected.id] ? "Запись добавлена в список ниже" : "Растение перейдёт к следующему дню"}</small></button>
        <button className={styles.secondaryAction} onClick={sayKindWord}><span>♡</span><b>Сказать доброе слово</b><small>Оно услышит тебя</small></button>
        <button className={styles.secondaryAction} onClick={nourish}><span>✦</span><b>Дать удобрение</b><small>Цветок оживёт на секунду</small></button>
      </section>

      <section className={styles.dashboardGrid}>
        <article className={styles.checklistPanel}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>СЕГОДНЯ</span><h2>Что уже сделано</h2></div><b>{finishedToday} / {plants.length}</b></div>
          <div className={styles.checklist}>
            {plants.map((plant) => {
              const itemSpecies = getSpecies(plant.species);
              const checked = Boolean(todayChecks[plant.id]);
              return <button key={plant.id} className={`${styles.checkRow} ${checked ? styles.checked : ""}`} onClick={() => completePlant(plant.id)} style={{ "--accent": itemSpecies.accent } as CSSProperties}><span className={styles.checkCircle}>{checked ? "✓" : ""}</span><span><small>{itemSpecies.name}</small><strong>{plant.habit}</strong></span><em>{checked ? "готово" : "отметить"}</em></button>;
            })}
          </div>
          <div className={styles.streakNote}><span>↗</span><p><strong>Твой сегодняшний ритм</strong><br />Каждая галочка — не оценка, а видимый след заботы.</p></div>
        </article>

        <article className={styles.dynamicsPanel}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ДИНАМИКА РОСТА</span><h2>Путь растения</h2></div><b>{selectedProgress}%</b></div>
          <div className={styles.stageTrack}><i style={{ width: stageWidth }} /></div>
          <div className={styles.stages}>{["Семечко", "Росток", "Листья", "Бутон", "Цветение"].map((label, index) => <div className={index <= selectedStage ? styles.stageReached : ""} key={label}><span>{index <= selectedStage ? "✦" : "·"}</span><small>{label}</small></div>)}</div>
          <div className={styles.miniChart}><span>Выполнения по дням</span><div>{[.35, .52, .24, .68, .48, .76, todayChecks[selected.id] ? 1 : .3].map((height, index) => <i key={index} className={index === 6 && todayChecks[selected.id] ? styles.chartToday : ""} style={{ height: `${Math.max(12, height * 100)}%` }} />)}</div><small>прошлая неделя <b>→ сегодня</b></small></div>
        </article>
      </section>

      <section className={styles.collection} id="plants">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ТВОЯ ОРАНЖЕРЕЯ</span><h2>Каждая цель растёт по-своему</h2></div><button onClick={() => setShowPlanting(true)}>＋ Посадить новое</button></div>
        <div className={styles.plantGrid}>
          {plants.map((plant) => {
            const itemSpecies = getSpecies(plant.species);
            const active = plant.id === selected.id;
            return <button key={plant.id} className={`${styles.plantCard} ${active ? styles.activeCard : ""}`} onClick={() => completePlant(plant.id)} style={{ "--accent": itemSpecies.accent } as CSSProperties}><div className={styles.cardTop}><span>{itemSpecies.name}</span><b>{todayChecks[plant.id] ? "✓ сегодня" : `${progressFor(plant)}%`}</b></div><PlantArt plant={plant} effect={effect?.plantId === plant.id ? effect.kind : undefined} /><div className={styles.cardCopy}><small>{stageName(growthStage(plant))}</small><strong>{plant.habit}</strong><span>{plant.completedDays} из {plant.durationDays} дней</span></div><div className={styles.cardProgress}><i style={{ width: `${progressFor(plant)}%` }} /></div><div className={styles.cardAction}>{todayChecks[plant.id] ? "Сегодня уже заботилась" : "Нажать · отметить выполнение"}</div></button>;
          })}
          <button className={styles.emptyCard} onClick={() => setShowPlanting(true)}><span>＋</span><strong>Свободное место</strong><small>Выбрать семечко и новую привычку</small></button>
        </div>
      </section>

      <footer className={styles.footer}><span>Пробная 2D-концепция «Рост»</span><p>Удобрение и слова поддерживают настроение. Рост растения всегда связан только с реальными выполнениями привычки.</p><Link href="/">Вернуться на главную</Link></footer>

      {showPlanting && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlanting(false); }}><form className={styles.modal} onSubmit={plantNewHabit}><button className={styles.modalClose} type="button" onClick={() => setShowPlanting(false)} aria-label="Закрыть">×</button><span className={styles.eyebrow}>НОВАЯ ЖИВАЯ ЦЕЛЬ</span><h2>Выбери, кого будешь растить</h2><p>У каждого растения свой характер, но скорость роста зависит только от выбранного срока и твоих отметок.</p><label><span>Моя привычка</span><input value={newHabit} onChange={(event) => setNewHabit(event.target.value)} autoFocus /></label><fieldset><legend>Растение</legend><div className={styles.speciesGrid}>{species.map((item) => { const preview: PlantHabit = { id: item.code, habit: item.name, species: item.code, completedDays: 30, durationDays: 30 }; return <button type="button" key={item.code} className={newSpecies === item.code ? styles.selectedSpecies : ""} onClick={() => setNewSpecies(item.code)}><PlantArt plant={preview} /><b>{item.name}</b><small>{item.character}</small></button>; })}</div></fieldset><fieldset><legend>Срок роста</legend><div className={styles.durationGrid}>{[14, 30, 60].map((days) => <button type="button" className={newDuration === days ? styles.selectedDuration : ""} key={days} onClick={() => setNewDuration(days)}><b>{days}</b><span>дней</span></button>)}</div></fieldset><button className={styles.plantButtonModal} type="submit"><span>Посадить семечко</span><b>→</b></button></form></div>}
    </main>
  );
}
