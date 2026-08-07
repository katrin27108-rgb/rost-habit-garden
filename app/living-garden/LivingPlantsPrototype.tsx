"use client";

import Link from "next/link";
import { FormEvent, useState, type CSSProperties } from "react";
import styles from "./living-garden.module.css";

type SpeciesCode = "sunflower" | "tomato" | "lavender" | "monstera";

type Species = {
  code: SpeciesCode;
  name: string;
  character: string;
  atlasRow: number;
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
  { code: "sunflower", name: "Подсолнух", character: "Солнечный и смелый", atlasRow: 0, accent: "#e8ad2d" },
  { code: "tomato", name: "Томат черри", character: "Щедрый и бодрый", atlasRow: 1, accent: "#d76a4d" },
  { code: "lavender", name: "Лаванда", character: "Спокойная и нежная", atlasRow: 2, accent: "#8c79a8" },
  { code: "monstera", name: "Монстера", character: "Уверенная и стойкая", atlasRow: 3, accent: "#4f8460" },
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

function getSpecies(code: SpeciesCode) {
  return species.find((item) => item.code === code) ?? species[0];
}

function growthStage(plant: PlantHabit) {
  return Math.min(4, Math.floor((plant.completedDays / plant.durationDays) * 5));
}

function stageName(stage: number) {
  return ["Семечко", "Первые листья", "Молодое растение", "Скоро цветение", "Взрослое растение"][stage];
}

function PlantArt({ plant, className = "" }: { plant: PlantHabit; className?: string }) {
  const plantSpecies = getSpecies(plant.species);
  const stage = growthStage(plant);
  const artStyle = {
    backgroundImage: "url('/plant-growth-atlas.png')",
    backgroundSize: "500% 400%",
    backgroundPosition: `${stage * 25}% ${plantSpecies.atlasRow * (100 / 3)}%`,
  } satisfies CSSProperties;

  return (
    <div
      className={`${styles.plantArt} ${className}`}
      style={artStyle}
      role="img"
      aria-label={`${plantSpecies.name}, стадия: ${stageName(stage)}`}
    />
  );
}

export default function LivingPlantsPrototype() {
  const [plants, setPlants] = useState(initialPlants);
  const [selectedId, setSelectedId] = useState(initialPlants[0].id);
  const [doneToday, setDoneToday] = useState<string[]>([]);
  const [nourished, setNourished] = useState<string[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [celebrating, setCelebrating] = useState("");
  const [showPlanting, setShowPlanting] = useState(false);
  const [newHabit, setNewHabit] = useState("Вечерняя растяжка");
  const [newSpecies, setNewSpecies] = useState<SpeciesCode>("tomato");
  const [newDuration, setNewDuration] = useState(30);

  const selected = plants.find((plant) => plant.id === selectedId) ?? plants[0];
  const selectedSpecies = getSpecies(selected.species);
  const selectedProgress = Math.round((selected.completedDays / selected.durationDays) * 100);
  const selectedStage = growthStage(selected);
  const todayCount = doneToday.length;

  function completeToday() {
    if (doneToday.includes(selected.id) || selected.completedDays >= selected.durationDays) return;
    setPlants((current) => current.map((plant) => plant.id === selected.id
      ? { ...plant, completedDays: Math.min(plant.durationDays, plant.completedDays + 1) }
      : plant));
    setDoneToday((current) => [...current, selected.id]);
    setMessages((current) => ({
      ...current,
      [selected.id]: "Спасибо! У меня появился новый кусочек жизни. И ты сегодня тоже выросла.",
    }));
    setCelebrating(selected.id);
  }

  function sayKindWord() {
    setMessages((current) => ({
      ...current,
      [selected.id]: "Я тебя услышало. Будем расти не спеша — столько, сколько нужно.",
    }));
  }

  function nourish() {
    setNourished((current) => current.includes(selected.id) ? current : [...current, selected.id]);
    setMessages((current) => ({
      ...current,
      [selected.id]: "Как приятно! Удобрение добавило мне блеска, а настоящий рост даст твой следующий шаг.",
    }));
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
          <span>Сегодня выращено: <b>{todayCount}</b></span>
          <Link className={styles.backLink} href="/garden-prototype">Сравнить с 3D</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>ПЯТНИЦА · ДЕНЬ, КОТОРЫЙ МОЖНО ВЫРАСТИТЬ</p>
          <h1>Твоя привычка<br />становится <em>живой</em></h1>
          <p className={styles.lead}>Не график и не условный кубик. Каждое выполненное действие даёт твоему растению новый лист, бутон или плод.</p>
          <div className={styles.heroStats}>
            <div><strong>{plants.length}</strong><span>живых растения</span></div>
            <div><strong>{plants.reduce((sum, plant) => sum + plant.completedDays, 0)}</strong><span>дней заботы</span></div>
            <div><strong>30</strong><span>дней до цветения</span></div>
          </div>
        </div>

        <article className={`${styles.featured} ${celebrating === selected.id ? styles.celebrating : ""}`} style={{ "--accent": selectedSpecies.accent } as CSSProperties}>
          <div className={styles.sunGlow} aria-hidden="true" />
          <div className={styles.speech} aria-live="polite">
            <span>“</span>{messages[selected.id] ?? defaultMessages[selected.species]}
          </div>
          <div className={styles.sparkles} aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>·</i></div>
          <PlantArt plant={selected} className={nourished.includes(selected.id) ? styles.nourished : ""} />
          <div className={styles.featuredMeta}>
            <div>
              <span>{selectedSpecies.name} · {stageName(selectedStage)}</span>
              <h2>{selected.habit}</h2>
            </div>
            <b>{selectedProgress}%</b>
          </div>
          <div className={styles.progressTrack}><i style={{ width: `${selectedProgress}%` }} /></div>
          <div className={styles.progressLabels}><span>День {selected.completedDays} из {selected.durationDays}</span><span>Следующая стадия — через {Math.max(1, Math.ceil(selected.durationDays / 5) - (selected.completedDays % Math.ceil(selected.durationDays / 5)))} дн.</span></div>
        </article>
      </section>

      <section className={styles.ritual} aria-label="Действия с выбранным растением">
        <div className={styles.ritualIntro}>
          <span className={styles.eyebrow}>МАЛЕНЬКИЙ РИТУАЛ НА СЕГОДНЯ</span>
          <strong>Как позаботимся о {selectedSpecies.name.toLowerCase()}?</strong>
        </div>
        <button className={styles.primaryAction} onClick={completeToday} disabled={doneToday.includes(selected.id) || selected.completedDays >= selected.durationDays}>
          <span>{doneToday.includes(selected.id) ? "✓" : "＋"}</span>
          <b>{doneToday.includes(selected.id) ? "Сегодня выполнено" : "Я сделала это сегодня"}</b>
          <small>{doneToday.includes(selected.id) ? "Растение запомнило этот день" : "Растение перейдёт к следующему дню роста"}</small>
        </button>
        <button className={styles.secondaryAction} onClick={sayKindWord}>
          <span>♡</span><b>Сказать доброе слово</b><small>Поддержать настроение</small>
        </button>
        <button className={styles.secondaryAction} onClick={nourish} disabled={nourished.includes(selected.id)}>
          <span>✦</span><b>{nourished.includes(selected.id) ? "Уже удобрено" : "Дать удобрение"}</b><small>Только визуальная забота</small>
        </button>
      </section>

      <section className={styles.collection} id="plants">
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>ТВОЯ ОРАНЖЕРЕЯ</span><h2>Каждая цель растёт по-своему</h2></div>
          <button onClick={() => setShowPlanting(true)}>＋ Посадить новое</button>
        </div>
        <div className={styles.plantGrid}>
          {plants.map((plant) => {
            const itemSpecies = getSpecies(plant.species);
            const progress = Math.round((plant.completedDays / plant.durationDays) * 100);
            const active = plant.id === selected.id;
            return (
              <button key={plant.id} className={`${styles.plantCard} ${active ? styles.activeCard : ""}`} onClick={() => { setSelectedId(plant.id); setCelebrating(""); }} style={{ "--accent": itemSpecies.accent } as CSSProperties}>
                <div className={styles.cardTop}><span>{itemSpecies.name}</span><b>{active ? "Сейчас здесь" : `${progress}%`}</b></div>
                <PlantArt plant={plant} />
                <div className={styles.cardCopy}>
                  <small>{stageName(growthStage(plant))}</small>
                  <strong>{plant.habit}</strong>
                  <span>{plant.completedDays} из {plant.durationDays} дней</span>
                </div>
                <div className={styles.cardProgress}><i style={{ width: `${progress}%` }} /></div>
              </button>
            );
          })}
          <button className={styles.emptyCard} onClick={() => setShowPlanting(true)}>
            <span>＋</span><strong>Свободное место</strong><small>Выбрать семечко и новую привычку</small>
          </button>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Пробная 2D-концепция «Рост»</span>
        <p>Декоративные действия поддерживают настроение, но рост растения всегда связан только с реальными выполнениями привычки.</p>
        <Link href="/">Вернуться на главную</Link>
      </footer>

      {showPlanting && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlanting(false); }}>
          <form className={styles.modal} onSubmit={plantNewHabit}>
            <button className={styles.modalClose} type="button" onClick={() => setShowPlanting(false)} aria-label="Закрыть">×</button>
            <span className={styles.eyebrow}>НОВАЯ ЖИВАЯ ЦЕЛЬ</span>
            <h2>Выбери, кого будешь растить</h2>
            <p>У каждого растения свой характер, но скорость роста зависит только от выбранного срока и твоих отметок.</p>
            <label><span>Моя привычка</span><input value={newHabit} onChange={(event) => setNewHabit(event.target.value)} autoFocus /></label>
            <fieldset>
              <legend>Растение</legend>
              <div className={styles.speciesGrid}>
                {species.map((item) => {
                  const preview: PlantHabit = { id: item.code, habit: item.name, species: item.code, completedDays: 30, durationDays: 30 };
                  return <button type="button" key={item.code} className={newSpecies === item.code ? styles.selectedSpecies : ""} onClick={() => setNewSpecies(item.code)}><PlantArt plant={preview} /><b>{item.name}</b><small>{item.character}</small></button>;
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend>Срок роста</legend>
              <div className={styles.durationGrid}>{[14, 30, 60].map((days) => <button type="button" className={newDuration === days ? styles.selectedDuration : ""} key={days} onClick={() => setNewDuration(days)}><b>{days}</b><span>дней</span></button>)}</div>
            </fieldset>
            <button className={styles.plantButton} type="submit"><span>Посадить семечко</span><b>→</b></button>
          </form>
        </div>
      )}
    </main>
  );
}
