"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState, type CSSProperties } from "react";
import styles from "./living-garden.module.css";

type SpeciesCode = "sunflower" | "tomato" | "lavender" | "monstera" | "oak" | "apple";
type CareEffect = "growOut" | "growIn" | "fertilizer" | "kind" | "upgrade";
type Frequency = "daily" | "weekly" | "threeWeekly";

type Species = {
  code: SpeciesCode;
  name: string;
  character: string;
  family: string;
  accent: string;
};

type PlantHabit = {
  id: string;
  habit: string;
  species: SpeciesCode;
  completedDays: number;
  frequency: Frequency;
  reminder: string | null;
};

const TOTAL_STAGES = 30;
const FERTILIZER_PRICE = 25;
const UPGRADE_PRICE = 40;

const species: Species[] = [
  { code: "sunflower", name: "Подсолнух", character: "Солнечный и смелый", family: "Цветок", accent: "#d9a126" },
  { code: "tomato", name: "Томат черри", character: "Щедрый и бодрый", family: "Плодовое", accent: "#cf6b4e" },
  { code: "lavender", name: "Лаванда", character: "Спокойная и нежная", family: "Цветок", accent: "#8a73a9" },
  { code: "monstera", name: "Монстера", character: "Уверенная и стойкая", family: "Комнатное", accent: "#4f8064" },
  { code: "oak", name: "Дуб", character: "Надёжный и терпеливый", family: "Дерево", accent: "#72834d" },
  { code: "apple", name: "Яблоня", character: "Заботливая и щедрая", family: "Дерево", accent: "#ba665e" },
];

const initialPlants: PlantHabit[] = [
  { id: "walk", habit: "Гулять 30 минут", species: "sunflower", completedDays: 11, frequency: "daily", reminder: "18:30" },
  { id: "read", habit: "Читать перед сном", species: "lavender", completedDays: 7, frequency: "daily", reminder: "21:30" },
  { id: "water", habit: "Пить достаточно воды", species: "monstera", completedDays: 22, frequency: "daily", reminder: "09:00" },
  { id: "reflect", habit: "Подводить итоги недели", species: "oak", completedDays: 15, frequency: "weekly", reminder: "18:30" },
  { id: "vegetables", habit: "Добавлять овощи в обед", species: "tomato", completedDays: 19, frequency: "threeWeekly", reminder: null },
];

const frequencyLabels: Record<Frequency, string> = {
  daily: "Каждый день",
  weekly: "Раз в неделю",
  threeWeekly: "3 раза в неделю",
};

const growthDescriptions: Record<SpeciesCode, readonly string[]> = {
  sunflower: [
    "Семечко ждёт в тёплой земле", "Оболочка семени раскрывается", "Появляется первый корешок", "Росток тянется вверх", "Согнутый росток выходит к свету",
    "Стебелёк выпрямляется", "Семядоли готовятся раскрыться", "Раскрываются две семядоли", "Появляется первый настоящий лист", "Раскрывается первая пара листьев",
    "Намечается новая пара листьев", "Стебель становится крепче", "Появляется новый листовой узел", "Листьев становится заметно больше", "Молодой подсолнух вытягивается",
    "Крона начинает ветвиться", "Растение становится крепким", "Листовая крона густеет", "Стебель быстро набирает высоту", "Листья достигают взрослой формы",
    "На вершине появляется бутон", "Бутон становится круглее", "Зелёный бутон увеличивается", "Чешуйки бутона расходятся", "Видны кончики жёлтых лепестков",
    "Лепестки выходят из бутона", "Цветок раскрывается на четверть", "Подсолнух раскрыт наполовину", "Цветок почти полностью открыт", "Подсолнух расцвёл",
  ],
  tomato: [
    "Семечко лежит в земле", "Оболочка семени треснула", "Показался первый корешок", "Росток выходит из земли", "Росток тянется к свету",
    "Стебелёк выпрямляется", "Семядоли освобождаются", "Раскрываются две семядоли", "Появился первый зубчатый лист", "Растёт первая пара листьев",
    "Формируется следующий лист", "Стебель становится толще", "Появляется боковой побег", "Кустик начинает ветвиться", "Листьев становится больше",
    "Побеги расходятся в стороны", "Томат становится крепче", "Формируется цветочная кисть", "Появляются первые бутоны", "Бутоны готовы раскрыться",
    "Распускается первый жёлтый цветок", "Цветков становится больше", "Появляется зелёная завязь", "Растут маленькие помидоры", "Зелёные плоды увеличиваются",
    "Плоды наливаются", "Помидоры начинают желтеть", "Плоды становятся оранжевыми", "Почти все томаты покраснели", "Томаты полностью созрели",
  ],
  lavender: [
    "Семечко отдыхает в земле", "Семечко раскрывается", "Появляется тонкий корешок", "Росток пробивается наружу", "Росток распрямляет спинку",
    "Стебелёк поднимается", "Семядоли освобождаются", "Раскрываются первые листочки", "Появляется пара узких листьев", "Растёт следующая пара листьев",
    "Молодые листья удлиняются", "Формируется маленькая розетка", "Розетка становится плотнее", "Лаванда ветвится у основания", "Кустик становится округлым",
    "Появляются новые боковые побеги", "Кустик заметно густеет", "Листья приобретают серебристый оттенок", "Поднимается первый цветонос", "Появляются новые цветоносы",
    "На верхушках видны бутоны", "Бутоны собираются в колоски", "Колоски становятся плотнее", "Нижние цветки раскрываются", "На стеблях появляется фиолетовый цвет",
    "Распускается половина колосков", "Фиолетовых цветков всё больше", "Куст покрывается цветами", "Лаванда почти полностью раскрылась", "Лаванда пышно расцвела",
  ],
  monstera: [
    "Семечко лежит во влажной земле", "Семечко раскрывается", "Появляется корешок", "Росток выходит наружу", "Первый лист остаётся свёрнутым",
    "Лист поднимается выше", "Молодой лист начинает раскрываться", "Раскрывается первый цельный лист", "Поднимается второй лист", "Второй лист становится крупнее",
    "Появляется третий цельный лист", "Черешки становятся крепче", "Растёт четвёртый молодой лист", "Листья набирают размер", "Куст становится гуще",
    "Появляется новый высокий черешок", "На листе намечается первый разрез", "Первый разрез становится глубже", "Разрезов становится больше", "Появляется первое внутреннее отверстие",
    "Новый лист раскрывается резным", "Листья становятся шире", "Появляются воздушные корни", "Резных листьев становится больше", "Монстера заполняет пространство",
    "Новый лист крупнее предыдущего", "Куст становится многоярусным", "Листья раскрывают новые отверстия", "Монстера почти взрослая", "Монстера стала пышной и взрослой",
  ],
  oak: [
    "Жёлудь лежит на земле", "Скорлупа желудя треснула", "Появляется первый корень", "Корешок закрепляется в почве", "Побег выходит из желудя",
    "Росток делает изгиб", "Стебелёк тянется вверх", "Раскрывается первая почка", "Появляются первые дубовые листья", "Растёт вторая пара листьев",
    "Молодые листья расправляются", "Стволик становится толще", "Появляется новый листовой ярус", "Закладывается первая веточка", "Веточка уходит в сторону",
    "Появляется вторая боковая ветвь", "Саженец становится выше", "Крона начинает округляться", "Ствол приобретает древесный оттенок", "Ветви становятся крепче",
    "Крона заметно густеет", "Появляются веточки второго порядка", "Молодой дуб становится устойчивее", "Листья заполняют крону", "Ствол становится древесным",
    "Крона расширяется в стороны", "Дуб набирает силу", "Молодое дерево становится пышным", "Крона почти сформирована", "Вырос крепкий молодой дуб",
  ],
  apple: [
    "Яблочное семечко лежит в земле", "Семечко раскрывается", "Появляется белый корешок", "Росток выходит наружу", "Стебелёк тянется к свету",
    "Росток распрямляется", "Раскрываются семядоли", "Появляется первый овальный лист", "Растёт вторая пара листьев", "Листья становятся зубчатыми",
    "Стволик набирает толщину", "Появляется первая боковая веточка", "Формируется вторая ветвь", "Саженец становится выше", "Крона начинает округляться",
    "Ствол становится древесным", "Ветвей становится больше", "Крона густеет", "Появляются цветочные почки", "Почки становятся розовыми",
    "Распускаются первые цветы", "Белых цветков становится больше", "Яблоня покрывается цветами", "Появляются маленькие завязи", "Растут зелёные яблоки",
    "Яблоки становятся крупнее", "Плоды начинают светлеть", "На яблоках появляется румянец", "Почти все плоды созрели", "Яблоня вырастила спелые яблоки",
  ],
};

const praiseMessages = [
  "Это не просто галочка — ты снова выбрала себя. Посмотри, как сад отвечает тебе ростом.",
  "Ты сделала ещё один настоящий шаг. Маленький сегодня — заметный для твоего растения.",
  "Вот так и рождается постоянство: спокойно, бережно и без требования быть идеальной.",
  "Ты умница. Растение изменилось прямо сейчас, потому что твоё действие действительно случилось.",
  "Этот шаг уже твой. Сад запомнил его и стал немного живее.",
];

const dailyQuote = "Не нужно менять всю жизнь за один день. Достаточно одного доброго действия, которое ты повторишь сегодня.";

function getSpecies(code: SpeciesCode) {
  return species.find((item) => item.code === code) ?? species[0];
}

function frameFor(plant: PlantHabit) {
  return Math.min(TOTAL_STAGES - 1, Math.max(0, plant.completedDays));
}

function GrowthFrame({ plant }: { plant: PlantHabit }) {
  const frame = frameFor(plant);
  return (
    <Image
      className={styles.frameImage}
      src={`/plants/growth/${plant.species}/${String(frame).padStart(2, "0")}.png?v=3`}
      alt=""
      width={384}
      height={384}
      unoptimized
      aria-hidden="true"
    />
  );
}

function PlantArt({ plant, effect, className = "" }: { plant: PlantHabit; effect?: CareEffect; className?: string }) {
  const plantSpecies = getSpecies(plant.species);
  const frame = frameFor(plant);
  return (
    <div
      className={`${styles.plantArt} ${effect ? styles[effect] : ""} ${className}`}
      style={{ "--accent": plantSpecies.accent } as CSSProperties}
      role="img"
      aria-label={`${plantSpecies.name}. ${growthDescriptions[plant.species][frame]}. Этап ${frame + 1} из ${TOTAL_STAGES}.`}
    >
      <GrowthFrame plant={plant} />
      {effect === "fertilizer" && <span className={styles.fertilizerDust} aria-hidden="true">✦ ✧ ✦</span>}
      {effect === "kind" && <span className={styles.kindHearts} aria-hidden="true">♡ ♡ ♡</span>}
      {effect === "upgrade" && <span className={styles.upgradeGlow} aria-hidden="true">✦</span>}
    </div>
  );
}

export default function LivingPlantsPrototype() {
  const [plants, setPlants] = useState(initialPlants);
  const [selectedId, setSelectedId] = useState(initialPlants[0].id);
  const [todayChecks, setTodayChecks] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [effect, setEffect] = useState<{ plantId: string; kind: CareEffect } | null>(null);
  const [points, setPoints] = useState(120);
  const [showPlanting, setShowPlanting] = useState(false);
  const [newHabit, setNewHabit] = useState("Утренняя разминка");
  const [newSpecies, setNewSpecies] = useState<SpeciesCode>("apple");
  const [newFrequency, setNewFrequency] = useState<Frequency>("daily");
  const [newReminder, setNewReminder] = useState<string | null>("09:00");

  const selected = plants.find((plant) => plant.id === selectedId) ?? plants[0];
  const selectedSpecies = getSpecies(selected.species);
  const selectedFrame = frameFor(selected);
  const finishedToday = plants.filter((plant) => todayChecks[plant.id]).length;
  const streak = 8 + finishedToday;

  function showCareEffect(plantId: string, kind: CareEffect) {
    setEffect({ plantId, kind });
    window.setTimeout(() => setEffect((current) => current?.plantId === plantId && current.kind === kind ? null : current), 1800);
  }

  function completePlant(plantId: string) {
    const plant = plants.find((item) => item.id === plantId);
    if (!plant) return;
    setSelectedId(plantId);
    if (todayChecks[plantId] || plant.completedDays >= TOTAL_STAGES) return;

    setTodayChecks((current) => ({ ...current, [plantId]: true }));
    setEffect({ plantId, kind: "growOut" });
    window.setTimeout(() => {
      setPlants((current) => current.map((item) => item.id === plantId
        ? { ...item, completedDays: Math.min(TOTAL_STAGES, item.completedDays + 1) }
        : item));
      setPoints((current) => current + 10);
      setMessages((current) => ({ ...current, [plantId]: praiseMessages[(plant.completedDays + 1) % praiseMessages.length] }));
      setEffect({ plantId, kind: "growIn" });
      window.setTimeout(() => setEffect((current) => current?.plantId === plantId && current.kind === "growIn" ? null : current), 820);
    }, 430);
  }

  function sayKindWord() {
    setMessages((current) => ({ ...current, [selected.id]: "Ты уже делаешь достаточно. Можно выдохнуть и заметить, сколько живого выросло благодаря тебе." }));
    showCareEffect(selected.id, "kind");
  }

  function nourish() {
    if (points < FERTILIZER_PRICE) {
      setMessages((current) => ({ ...current, [selected.id]: "До удобрения осталось совсем немного очков. Они приходят за регулярные настоящие отметки." }));
      return;
    }
    setPoints((current) => current - FERTILIZER_PRICE);
    setMessages((current) => ({ ...current, [selected.id]: "Удобрение добавлено. Ты бережно заботишься о саде — и это тоже заслуживает похвалы." }));
    showCareEffect(selected.id, "fertilizer");
  }

  function upgradeGarden() {
    if (points < UPGRADE_PRICE) {
      setMessages((current) => ({ ...current, [selected.id]: "Ещё несколько регулярных шагов — и новая садовая табличка станет доступна." }));
      return;
    }
    setPoints((current) => current - UPGRADE_PRICE);
    setMessages((current) => ({ ...current, [selected.id]: "Новая табличка уже в саду. Твоё постоянство превращается в красоту, которую можно увидеть." }));
    showCareEffect(selected.id, "upgrade");
  }

  function updateSelected(patch: Partial<Pick<PlantHabit, "frequency" | "reminder">>) {
    setPlants((current) => current.map((plant) => plant.id === selected.id ? { ...plant, ...patch } : plant));
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
      frequency: newFrequency,
      reminder: newReminder,
    };
    setPlants((current) => [...current, plant]);
    setSelectedId(plant.id);
    setMessages((current) => ({ ...current, [plant.id]: "Какой хороший выбор. Здесь начинается новая история — с семечка и твоего первого бережного шага." }));
    setShowPlanting(false);
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true"><i /><i /><i /></div>

      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Вернуться в основной сад">
          <span className={styles.brandMark}>р</span>
          <span><strong>РОСТ</strong><small>мой живой сад</small></span>
        </Link>
        <nav className={styles.nav} aria-label="Навигация сада">
          <a href="#garden">Растения в моём саду</a>
          <span className={styles.pointsBadge}>✦ <b>{points}</b> очков</span>
          <Link className={styles.backLink} href="/garden-prototype">Открыть 3D-сад</Link>
        </nav>
      </header>

      <section className={styles.workspace} aria-label="Мой сад сегодня">
        <aside className={styles.habitsPanel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.eyebrow}>МОЙ САД · СЕГОДНЯ</span><h1>Что будем растить?</h1></div>
            <b>{finishedToday}/{plants.length}</b>
          </div>

          <blockquote className={styles.dailyMessage}>
            <span>Послание на сегодня</span>
            <p>«{dailyQuote}»</p>
            <small>бережная оценка «Рост»</small>
          </blockquote>

          <div className={styles.habitList}>
            {plants.map((plant) => {
              const itemSpecies = getSpecies(plant.species);
              const checked = Boolean(todayChecks[plant.id]);
              const active = plant.id === selected.id;
              return (
                <button
                  key={plant.id}
                  className={`${styles.habitRow} ${checked ? styles.checked : ""} ${active ? styles.activeHabit : ""}`}
                  style={{ "--accent": itemSpecies.accent } as CSSProperties}
                  onClick={() => completePlant(plant.id)}
                >
                  <span className={styles.checkCircle}>{checked ? "✓" : ""}</span>
                  <span className={styles.habitCopy}>
                    <small>{itemSpecies.name} · {frequencyLabels[plant.frequency]}</small>
                    <strong>{plant.habit}</strong>
                    <em>{plant.reminder ? `Напомнить в ${plant.reminder}` : "Без напоминания"}</em>
                  </span>
                  <span className={styles.rowStage}>{frameFor(plant) + 1}<small>/30</small></span>
                </button>
              );
            })}
          </div>

          <button className={styles.addHabit} onClick={() => setShowPlanting(true)}><span>＋</span><b>Посадить новую привычку</b></button>
        </aside>

        <article className={`${styles.plantStage} ${effect?.plantId === selected.id ? styles.celebrating : ""}`} style={{ "--accent": selectedSpecies.accent } as CSSProperties}>
          <div className={styles.stageTop}>
            <div><span className={styles.eyebrow}>{selectedSpecies.family} · {selectedSpecies.name}</span><h2>{selected.habit}</h2></div>
            <div className={styles.stageCounter}><span>этап</span><b>{selectedFrame + 1}</b><small>из 30</small></div>
          </div>

          <div className={styles.plantScene}>
            <span className={styles.sunGlow} aria-hidden="true" />
            <PlantArt plant={selected} effect={effect?.plantId === selected.id ? effect.kind : undefined} />
            <div className={styles.growthCaption}><span>Сейчас происходит</span><strong>{growthDescriptions[selected.species][selectedFrame]}</strong></div>
          </div>

          <div className={styles.liveMessage} aria-live="polite">
            <span>“</span>
            <p>{messages[selected.id] ?? "Ты уже начала. Нажми на привычку слева — галочка сохранится, а я сразу покажу тебе следующий настоящий этап роста."}</p>
          </div>

          <div className={styles.monthBlock}>
            <div className={styles.monthHeading}><span>30 отметок роста</span><b>{selected.completedDays} выполнено</b></div>
            <div className={styles.dayDots} aria-label={`${selected.completedDays} выполнений из 30`}>
              {Array.from({ length: TOTAL_STAGES }, (_, index) => (
                <i key={index} className={`${index < selected.completedDays ? styles.filledDay : ""} ${index === selected.completedDays ? styles.nextDay : ""}`}>{index + 1}</i>
              ))}
            </div>
          </div>

          <div className={styles.scheduleSettings}>
            <label><span>Ритм привычки</span><select value={selected.frequency} onChange={(event) => updateSelected({ frequency: event.target.value as Frequency })}><option value="daily">Каждый день</option><option value="threeWeekly">3 раза в неделю</option><option value="weekly">Раз в неделю</option></select></label>
            <label><span>Напоминание</span><select value={selected.reminder ?? "off"} onChange={(event) => updateSelected({ reminder: event.target.value === "off" ? null : event.target.value })}><option value="off">Не напоминать</option><option value="09:00">В 09:00</option><option value="18:30">В 18:30</option><option value="21:30">В 21:30</option></select></label>
          </div>
        </article>
      </section>

      <section className={styles.gardenSection} id="garden">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>РАСТЕНИЯ В МОЁМ САДУ</span><h2>У каждой привычки — свой живой характер</h2></div><p>Нажми на растение, чтобы посмотреть его календарь и рост.</p></div>
        <div className={styles.plantShelf}>
          {plants.map((plant) => {
            const itemSpecies = getSpecies(plant.species);
            return (
              <button key={plant.id} className={`${styles.shelfPlant} ${plant.id === selected.id ? styles.selectedShelfPlant : ""}`} style={{ "--accent": itemSpecies.accent } as CSSProperties} onClick={() => setSelectedId(plant.id)}>
                <PlantArt plant={plant} />
                <span><small>{itemSpecies.name}</small><strong>{plant.habit}</strong><em>{frameFor(plant) + 1} этап</em></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.supportGrid}>
        <article className={styles.careCard}>
          <div className={styles.cardHeading}><div><span className={styles.eyebrow}>ТЁПЛАЯ ЗАБОТА</span><h2>Поддержать растение</h2></div><b>✦ {points}</b></div>
          <p>Рост дают только выполненные привычки. Очки постоянства можно обменять на приятные улучшения сада.</p>
          <div className={styles.careActions}>
            <button onClick={sayKindWord}><span>♡</span><b>Доброе слово</b><small>бесплатно</small></button>
            <button onClick={nourish} disabled={points < FERTILIZER_PRICE}><span>✦</span><b>Удобрение</b><small>{FERTILIZER_PRICE} очков</small></button>
            <button onClick={upgradeGarden} disabled={points < UPGRADE_PRICE}><span>⌂</span><b>Украшение сада</b><small>{UPGRADE_PRICE} очков</small></button>
          </div>
        </article>

        <article className={styles.rhythmCard}>
          <span className={styles.eyebrow}>ПОСТОЯНСТВО</span>
          <div className={styles.streakNumber}><b>{streak}</b><span>дней<br />бережного ритма</span></div>
          <div className={styles.rhythmBar}><i style={{ width: `${Math.min(100, streak * 8)}%` }} /></div>
          <strong>Ты не начинаешь сначала после сложного дня.</strong>
          <p>Ты продолжаешь с того места, где остановилась. Это и есть устойчивый рост.</p>
          <small>Следующая награда: +30 очков на 14-м дне</small>
        </article>
      </section>

      <section className={styles.catalogSection}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>КОГО ЕЩЁ МОЖНО ВЫРАСТИТЬ</span><h2>Цветы, плодовые и деревья</h2></div><button onClick={() => setShowPlanting(true)}>＋ Выбрать новое</button></div>
        <div className={styles.catalogGrid}>
          {species.map((item) => {
            const preview: PlantHabit = { id: item.code, habit: item.name, species: item.code, completedDays: 29, frequency: "daily", reminder: null };
            return <button key={item.code} onClick={() => { setNewSpecies(item.code); setShowPlanting(true); }} style={{ "--accent": item.accent } as CSSProperties}><PlantArt plant={preview} /><span><small>{item.family}</small><b>{item.name}</b><em>{item.character}</em></span></button>;
          })}
        </div>
      </section>

      <footer className={styles.footer}><span>«Рост» · мой живой сад</span><p>Каждая отметка связана с отдельным физиологическим этапом растения. Поддержка — без давления, прогресс — без наказания.</p><Link href="/">Вернуться на главную</Link></footer>

      {showPlanting && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlanting(false); }}>
          <form className={styles.modal} onSubmit={plantNewHabit}>
            <button className={styles.modalClose} type="button" onClick={() => setShowPlanting(false)} aria-label="Закрыть">×</button>
            <span className={styles.eyebrow}>НОВАЯ ПРИВЫЧКА</span><h2>Посади ещё одну цель</h2><p>Выбери растение, удобный ритм и напоминание. Каждый выполненный шаг откроет один из 30 этапов.</p>
            <label className={styles.habitInput}><span>Моя привычка</span><input value={newHabit} onChange={(event) => setNewHabit(event.target.value)} autoFocus /></label>
            <fieldset><legend>Растение или дерево</legend><div className={styles.speciesGrid}>{species.map((item) => { const preview: PlantHabit = { id: item.code, habit: item.name, species: item.code, completedDays: 29, frequency: "daily", reminder: null }; return <button type="button" key={item.code} className={newSpecies === item.code ? styles.selectedChoice : ""} onClick={() => setNewSpecies(item.code)}><PlantArt plant={preview} /><b>{item.name}</b><small>{item.family}</small></button>; })}</div></fieldset>
            <fieldset><legend>Как часто</legend><div className={styles.choiceGrid}>{(Object.keys(frequencyLabels) as Frequency[]).map((frequency) => <button type="button" key={frequency} className={newFrequency === frequency ? styles.selectedChoice : ""} onClick={() => setNewFrequency(frequency)}>{frequencyLabels[frequency]}</button>)}</div></fieldset>
            <fieldset><legend>Напоминание</legend><div className={styles.choiceGrid}>{([null, "09:00", "18:30", "21:30"] as const).map((time) => <button type="button" key={time ?? "off"} className={newReminder === time ? styles.selectedChoice : ""} onClick={() => setNewReminder(time)}>{time ? `В ${time}` : "Не напоминать"}</button>)}</div></fieldset>
            <button className={styles.plantButtonModal} type="submit"><span>Посадить семечко</span><b>→</b></button>
          </form>
        </div>
      )}
    </main>
  );
}
