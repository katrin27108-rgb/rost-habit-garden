"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState, type CSSProperties } from "react";
import styles from "./living-garden.module.css";

type SpeciesCode = "sunflower" | "tomato" | "lavender" | "monstera";
type CareEffect = "growOut" | "growIn" | "fertilizer" | "kind";

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
  sunflower: "Каждый твой шаг открывает во мне ещё один маленький кусочек роста.",
  tomato: "Я остаюсь тем же растением и понемногу проявляюсь с каждым действием.",
  lavender: "Можно расти тихо: шаг за шагом, без скачков и резких превращений.",
  monstera: "Посмотри: после каждой отметки меня становится чуть больше.",
};

const careMessages = {
  grow: "Вижу твой шаг! Посмотри: растение прямо сейчас перешло к следующему живому состоянию.",
  fertilizer: "Как приятно! Цветок ожил — настоящий рост всё равно принесёт твой следующий шаг.",
  kind: "Я тебя услышало. Будем расти не спеша — столько, сколько нужно.",
};

function getSpecies(code: SpeciesCode) {
  return species.find((item) => item.code === code) ?? species[0];
}

function growthProgress(plant: PlantHabit) {
  return Math.min(1, Math.max(0, plant.completedDays / plant.durationDays));
}

function progressFor(plant: PlantHabit) {
  return Math.round((plant.completedDays / plant.durationDays) * 100);
}

const growthDescriptions: Record<SpeciesCode, string[]> = {
  sunflower: [
    "Семечко лежит в земле", "Семечко проклёвывается", "Росток пробивается к свету", "Росток выпрямляется",
    "Раскрываются две семядоли", "Появляется первый настоящий лист", "Раскрывается первая пара настоящих листьев", "Формируется вторая пара листьев",
    "Молодой подсолнух наращивает листья", "Стебель вытягивается, появляются новые узлы", "Подсолнух становится выше и крепче", "На вершине формируется крошечный бутон",
    "Бутон становится крупнее", "Показываются первые жёлтые лепестки", "Цветок раскрывается наполовину", "Подсолнух полностью расцвёл",
  ],
  tomato: [
    "Семечко лежит в земле", "Семечко проклёвывается", "Росток пробивается к свету", "Росток выпрямляется",
    "Раскрываются две семядоли", "Появляется первый зубчатый лист", "Раскрывается первая пара настоящих листьев", "Формируется следующая пара листьев",
    "Молодой томат наращивает листья", "Появляется первая боковая веточка", "Закладываются цветочные кисти", "Раскрываются жёлтые цветки",
    "Появляется первая зелёная завязь", "Подрастают зелёные помидоры", "Плоды постепенно краснеют", "Томаты полностью созрели",
  ],
  lavender: [
    "Семечко лежит в земле", "Семечко проклёвывается", "Росток пробивается к свету", "Росток выпрямляется",
    "Раскрываются две семядоли", "Появляются первые узкие листья", "Раскрывается вторая пара листьев", "Формируется маленькая розетка",
    "Лаванда начинает ветвиться у основания", "Кустик становится плотнее", "Поднимаются первые цветоносы", "На верхушках появляются бутоны",
    "Формируются плотные колоски", "Нижние цветки начинают раскрываться", "Колоски постепенно становятся фиолетовыми", "Лаванда полностью расцвела",
  ],
  monstera: [
    "Семечко лежит в земле", "Семечко проклёвывается", "Росток пробивается к свету", "Появляется свёрнутый лист",
    "Раскрывается первый цельный лист", "Поднимается второй молодой лист", "У монстеры уже три цельных листа", "Появляется четвёртый лист",
    "Молодые листья становятся крупнее", "Монстера наращивает густую листву", "На новом листе появляется первый разрез", "Формируется первое внутреннее отверстие",
    "Разрезов на листьях становится больше", "Новые листья становятся крупнее и резнее", "Рядом со взрослыми растёт молодой цельный лист", "Монстера стала взрослой и пышной",
  ],
};

function frameProgress(progress: number) {
  const exact = Math.min(15, Math.max(0, progress * 15));
  const frame = Math.floor(exact);
  return { frame, withinFrame: exact - frame };
}

function plantGrowthLabel(species: SpeciesCode, progress: number) {
  return growthDescriptions[species][frameProgress(progress).frame];
}

function nextPlantChange(species: SpeciesCode, progress: number, durationDays: number) {
  const currentFrame = frameProgress(progress).frame;
  const nextFrame = frameProgress(Math.min(1, progress + 1 / durationDays)).frame;
  if (nextFrame === currentFrame) return "нынешний росток ещё немного разовьётся";
  const label = growthDescriptions[species][nextFrame];
  return label.charAt(0).toLocaleLowerCase("ru") + label.slice(1);
}

function GrowthFrame({ species: code, progress }: { species: SpeciesCode; progress: number }) {
  const { frame, withinFrame } = frameProgress(progress);
  const frameScale = 1 + withinFrame * 0.012;
  return (
    <Image
      className={styles.frameImage}
      src={`/plants/growth/${code}/${String(frame).padStart(2, "0")}.png?v=2`}
      alt=""
      width={384}
      height={384}
      unoptimized
      aria-hidden="true"
      style={{ "--frame-scale": frameScale } as CSSProperties}
    />
  );
}

function PlantArt({ plant, effect, className = "" }: { plant: PlantHabit; effect?: CareEffect; className?: string }) {
  const plantSpecies = getSpecies(plant.species);
  const progress = growthProgress(plant);
  return (
    <div
      className={`${styles.plantArt} ${effect ? styles[effect] : ""} ${className}`}
      style={{ "--accent": plantSpecies.accent } as CSSProperties}
      role="img"
      aria-label={`${plantSpecies.name}. ${plantGrowthLabel(plant.species, progress)}. Рост ${Math.round(progress * 100)} процентов.`}
    >
      <GrowthFrame species={plant.species} progress={progress} />
      {effect === "fertilizer" && <span className={styles.fertilizerDust} aria-hidden="true">✦ ✧ ✦</span>}
      {effect === "kind" && <span className={styles.kindHearts} aria-hidden="true">♡  ♡  ♡</span>}
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
  const selectedGrowth = plantGrowthLabel(selected.species, growthProgress(selected));
  const selectedNextChange = nextPlantChange(selected.species, growthProgress(selected), selected.durationDays);
  const totalDays = plants.reduce((sum, plant) => sum + plant.completedDays, 0);
  const averageProgress = Math.round(plants.reduce((sum, plant) => sum + progressFor(plant), 0) / plants.length);
  const finishedToday = plants.filter((plant) => todayChecks[plant.id]).length;

  function showCareEffect(plantId: string, kind: CareEffect) {
    setEffect({ plantId, kind });
    window.setTimeout(() => setEffect((current) => current?.plantId === plantId && current.kind === kind ? null : current), 1800);
  }

  function completePlant(plantId: string) {
    const plant = plants.find((item) => item.id === plantId);
    if (!plant) return;
    setSelectedId(plantId);
    if (todayChecks[plantId] || plant.completedDays >= plant.durationDays) return;
    setTodayChecks((current) => ({ ...current, [plantId]: true }));
    setEffect({ plantId, kind: "growOut" });
    window.setTimeout(() => {
      setPlants((current) => current.map((item) => item.id === plantId
        ? { ...item, completedDays: Math.min(item.durationDays, item.completedDays + 1) }
        : item));
      setMessages((current) => ({ ...current, [plantId]: careMessages.grow }));
      setEffect({ plantId, kind: "growIn" });
      window.setTimeout(() => setEffect((current) => current?.plantId === plantId && current.kind === "growIn" ? null : current), 780);
    }, 430);
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
          <p className={styles.lead}>Подтверди действие рядом с растением и смотри, как семечко проклёвывается, выпускает листья, формирует бутон и постепенно расцветает.</p>
          <div className={styles.heroStats}>
            <div><strong>{plants.length}</strong><span>живых растения</span></div>
            <div><strong>{totalDays}</strong><span>дней заботы</span></div>
            <div><strong>{averageProgress}%</strong><span>средний рост</span></div>
          </div>
        </div>

        <article className={`${styles.featured} ${effect?.plantId === selected.id ? styles.celebrating : ""}`} style={{ "--accent": selectedSpecies.accent } as CSSProperties}>
          <div className={styles.featuredHeading}><span>{selectedSpecies.name} · живой рост</span><b>{selected.completedDays} шагов</b></div>
          <h2>{selected.habit}</h2>
          <div className={styles.featuredInteraction}>
            <div className={styles.plantViewport}>
              <PlantArt plant={selected} effect={effect?.plantId === selected.id ? effect.kind : undefined} />
              <span className={styles.growthNow}>{selectedGrowth}</span>
            </div>
            <div className={styles.growthControl}>
              <div className={styles.speech} aria-live="polite"><span>“</span>{messages[selected.id] ?? defaultMessages[selected.species]}</div>
              <span className={styles.eyebrow}>СЕГОДНЯШНИЙ ШАГ</span>
              <strong>Выполнила привычку?</strong>
              <p>Отметь её здесь и не отводи взгляд от растения — новый рост начнётся сразу.</p>
              <button className={styles.growAction} onClick={() => completePlant(selected.id)} disabled={todayChecks[selected.id] || selected.completedDays >= selected.durationDays}>
                <span>{todayChecks[selected.id] ? "✓" : "＋"}</span>
                <b>{todayChecks[selected.id] ? "Сегодняшний рост сохранён" : "Подтвердить выполнение"}</b>
              </button>
              <small className={styles.nextChange}>{todayChecks[selected.id] ? "Изменение уже видно на растении слева" : `После отметки ${selectedNextChange}`}</small>
            </div>
          </div>
          <div className={styles.featuredFooter}><span>{selected.completedDays} подтверждённых действий из {selected.durationDays}</span><strong>Каждое действие видно на растении</strong></div>
          <div className={styles.progressTrack}><i style={{ width: `${selectedProgress}%` }} /></div>
        </article>
      </section>

      <section className={styles.ritual} aria-label="Действия с выбранным растением">
        <div className={styles.ritualIntro}><span className={styles.eyebrow}>ЗАБОТА СЕГОДНЯ</span><strong>У растения тоже есть настроение</strong><small>Прогресс даёт только выполненная привычка. Остальное — тёплые жесты.</small></div>
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
              return <button key={plant.id} className={`${styles.checkRow} ${checked ? styles.checked : ""}`} onClick={() => setSelectedId(plant.id)} style={{ "--accent": itemSpecies.accent } as CSSProperties}><span className={styles.checkCircle}>{checked ? "✓" : ""}</span><span><small>{itemSpecies.name}</small><strong>{plant.habit}</strong></span><em>{plant.id === selected.id ? "выбрано" : "выбрать"}</em></button>;
            })}
          </div>
          <div className={styles.streakNote}><span>↗</span><p><strong>Твой сегодняшний ритм</strong><br />Каждая галочка — не оценка, а видимый след заботы.</p></div>
        </article>

        <article className={styles.dynamicsPanel}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ЖИВАЯ ДИНАМИКА</span><h2>Что растёт сейчас</h2></div><b>{selectedProgress}%</b></div>
          <div className={styles.growthDetails}>
            <div><span>Сейчас</span><strong>{selectedGrowth}</strong></div>
            <div><span>Подтверждено</span><strong>{selected.completedDays} действий</strong></div>
            <div><span>Следующий шаг</span><strong>{selectedNextChange}</strong></div>
          </div>
          <div className={styles.miniChart}><span>Выполнения по дням</span><div>{[.35, .52, .24, .68, .48, .76, todayChecks[selected.id] ? 1 : .3].map((height, index) => <i key={index} className={index === 6 && todayChecks[selected.id] ? styles.chartToday : ""} style={{ height: `${Math.max(12, height * 100)}%` }} />)}</div><small>прошлая неделя <b>→ сегодня</b></small></div>
        </article>
      </section>

      <section className={styles.collection} id="plants">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ТВОЯ ОРАНЖЕРЕЯ</span><h2>Каждая цель растёт по-своему</h2></div><button onClick={() => setShowPlanting(true)}>＋ Посадить новое</button></div>
        <div className={styles.plantGrid}>
          {plants.map((plant) => {
            const itemSpecies = getSpecies(plant.species);
            const active = plant.id === selected.id;
            return <button key={plant.id} className={`${styles.plantCard} ${active ? styles.activeCard : ""}`} onClick={() => setSelectedId(plant.id)} style={{ "--accent": itemSpecies.accent } as CSSProperties}><div className={styles.cardTop}><span>{itemSpecies.name}</span><b>{todayChecks[plant.id] ? "✓ сегодня" : `${progressFor(plant)}%`}</b></div><PlantArt plant={plant} effect={effect?.plantId === plant.id ? effect.kind : undefined} /><div className={styles.cardCopy}><small>{plantGrowthLabel(plant.species, growthProgress(plant))}</small><strong>{plant.habit}</strong><span>{plant.completedDays} из {plant.durationDays} действий</span></div><div className={styles.cardProgress}><i style={{ width: `${progressFor(plant)}%` }} /></div><div className={styles.cardAction}>{active ? "Выбрано · отметить наверху рядом с растением" : "Нажать · выбрать растение"}</div></button>;
          })}
          <button className={styles.emptyCard} onClick={() => setShowPlanting(true)}><span>＋</span><strong>Свободное место</strong><small>Выбрать семечко и новую привычку</small></button>
        </div>
      </section>

      <footer className={styles.footer}><span>Пробная 2D-концепция «Рост»</span><p>Удобрение и слова поддерживают настроение. Рост растения всегда связан только с реальными выполнениями привычки.</p><Link href="/">Вернуться на главную</Link></footer>

      {showPlanting && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlanting(false); }}><form className={styles.modal} onSubmit={plantNewHabit}><button className={styles.modalClose} type="button" onClick={() => setShowPlanting(false)} aria-label="Закрыть">×</button><span className={styles.eyebrow}>НОВАЯ ЖИВАЯ ЦЕЛЬ</span><h2>Выбери, кого будешь растить</h2><p>У каждого растения свой характер, но скорость роста зависит только от выбранного срока и твоих отметок.</p><label><span>Моя привычка</span><input value={newHabit} onChange={(event) => setNewHabit(event.target.value)} autoFocus /></label><fieldset><legend>Растение</legend><div className={styles.speciesGrid}>{species.map((item) => { const preview: PlantHabit = { id: item.code, habit: item.name, species: item.code, completedDays: 30, durationDays: 30 }; return <button type="button" key={item.code} className={newSpecies === item.code ? styles.selectedSpecies : ""} onClick={() => setNewSpecies(item.code)}><PlantArt plant={preview} /><b>{item.name}</b><small>{item.character}</small></button>; })}</div></fieldset><fieldset><legend>Срок роста</legend><div className={styles.durationGrid}>{[14, 30, 60].map((days) => <button type="button" className={newDuration === days ? styles.selectedDuration : ""} key={days} onClick={() => setNewDuration(days)}><b>{days}</b><span>дней</span></button>)}</div></fieldset><button className={styles.plantButtonModal} type="submit"><span>Посадить семечко</span><b>→</b></button></form></div>}
    </main>
  );
}
