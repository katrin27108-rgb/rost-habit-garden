"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  LIVING_GARDEN_STORAGE_KEY,
  LIVING_GARDEN_VERSION,
  LIVING_COMPLETION_REWARD,
  completedDaysFor,
  habitDaysFor,
  livingAchievementReward,
  livingDateKey,
  livingDecorations,
  livingGardenAchievementIds,
  livingGardenActivityStreak,
  livingGardenLongestActivityStreak,
  livingGardenPoints,
  livingHabitDates,
  mergeLivingGardenSnapshots,
  sanitizeLivingGardenSnapshot,
  unlockedLivingSpecies,
  type LivingDecorationCode,
  type LivingFrequency,
  type LivingGardenSnapshot,
  type LivingPlantHabit,
  type LivingPurchase,
  type LivingSpeciesCode,
} from "../../lib/living-garden-sync";
import {
  buildMonthlyGardenStatistic,
  livingMonthKey,
  livingMonthLabel,
  moveLivingMonth,
} from "../../lib/living-garden-statistics";
import AuthModal from "../AuthModal";
import styles from "./living-garden.module.css";

type SpeciesCode = LivingSpeciesCode;
type CareEffect = "growOut" | "growIn" | "fertilizer" | "kind" | "upgrade";
type Frequency = LivingFrequency;
type DecorationCode = LivingDecorationCode;

type Species = {
  code: SpeciesCode;
  name: string;
  character: string;
  family: string;
  accent: string;
  unlockPrice?: number;
};

type PlantHabit = LivingPlantHabit;

type HabitTip = {
  id: string;
  marker: string;
  category: "НАЧАТЬ" | "НЕ ЗАБЫТЬ" | "ПРОДОЛЖИТЬ";
  title: string;
  description: string;
  example: string;
  takeaway: string;
};

const TOTAL_STAGES = 30;
const MAX_GOAL_DAYS = 360;
const FERTILIZER_PRICE = 25;
const INITIAL_UPDATED_AT = "2026-08-10T00:00:00.000Z";

const species: Species[] = [
  { code: "sunflower", name: "Подсолнух", character: "Солнечный и смелый", family: "Цветок", accent: "#d9a126" },
  { code: "tomato", name: "Томат черри", character: "Щедрый и бодрый", family: "Плодовое", accent: "#cf6b4e" },
  { code: "lavender", name: "Лаванда", character: "Спокойная и нежная", family: "Цветок", accent: "#8a73a9" },
  { code: "monstera", name: "Монстера", character: "Уверенная и стойкая", family: "Комнатное", accent: "#4f8064" },
  { code: "oak", name: "Дуб", character: "Надёжный и терпеливый", family: "Дерево", accent: "#72834d" },
  { code: "apple", name: "Яблоня", character: "Заботливая и щедрая", family: "Дерево", accent: "#ba665e" },
  { code: "peony", name: "Пион", character: "Пышный и деликатный", family: "Редкий цветок", accent: "#c8788f", unlockPrice: 160 },
  { code: "sakura", name: "Сакура", character: "Тихая и волшебная", family: "Редкое дерево", accent: "#bd7f91", unlockPrice: 230 },
];

const decorations: { code: DecorationCode; name: string; detail: string; price: number; icon: string }[] = [
  { code: "sign", name: "Тёплая табличка", detail: "Появится у земли рядом с растением", price: 40, icon: "⌂" },
  { code: "lantern", name: "Фонарик-светлячок", detail: "Зажжётся мягким золотым светом", price: 60, icon: "✧" },
  { code: "stones", name: "Тропинка из камней", detail: "Ляжет полукругом перед растением", price: 75, icon: "•••" },
];

const initialPlants: PlantHabit[] = [
  { id: "walk", habit: "Гулять 30 минут", species: "sunflower", baseCompletedDays: 11, completionDates: [], continuationDates: [], goalDays: 30, rewardedGoals: [], frequency: "daily", reminder: "18:30", createdAt: INITIAL_UPDATED_AT, completedAt: null, updatedAt: INITIAL_UPDATED_AT },
  { id: "read", habit: "Читать перед сном", species: "lavender", baseCompletedDays: 7, completionDates: [], continuationDates: [], goalDays: 30, rewardedGoals: [], frequency: "daily", reminder: "21:30", createdAt: INITIAL_UPDATED_AT, completedAt: null, updatedAt: INITIAL_UPDATED_AT },
  { id: "water", habit: "Пить достаточно воды", species: "monstera", baseCompletedDays: 22, completionDates: [], continuationDates: [], goalDays: 30, rewardedGoals: [], frequency: "daily", reminder: "09:00", createdAt: INITIAL_UPDATED_AT, completedAt: null, updatedAt: INITIAL_UPDATED_AT },
  { id: "reflect", habit: "Подводить итоги недели", species: "oak", baseCompletedDays: 15, completionDates: [], continuationDates: [], goalDays: 30, rewardedGoals: [], frequency: "weekly", reminder: "18:30", createdAt: INITIAL_UPDATED_AT, completedAt: null, updatedAt: INITIAL_UPDATED_AT },
  { id: "vegetables", habit: "Добавлять овощи в обед", species: "tomato", baseCompletedDays: 19, completionDates: [], continuationDates: [], goalDays: 30, rewardedGoals: [], frequency: "threeWeekly", reminder: null, createdAt: INITIAL_UPDATED_AT, completedAt: null, updatedAt: INITIAL_UPDATED_AT },
];

const initialSnapshot: LivingGardenSnapshot = { version: LIVING_GARDEN_VERSION, plants: initialPlants, claimedAchievements: [], purchases: [] };

const frequencyLabels: Record<Frequency, string> = {
  daily: "Каждый день",
  weekly: "Раз в неделю",
  threeWeekly: "3 раза в неделю",
};

const habitTips: HabitTip[] = [
  {
    id: "tiny-entry",
    marker: "01",
    category: "НАЧАТЬ",
    title: "Сделай вход, а не всю привычку",
    description: "В трудный день уменьши действие до версии, на которую почти не нужно уговаривать себя. Цель мини-шага — начать движение, а не доказать силу воли.",
    example: "Не «гулять 30 минут», а «надеть кроссовки и открыть дверь». Не «прочитать главу», а «открыть книгу и прочитать один абзац».",
    takeaway: "Минимальная версия тоже считается настоящим возвращением.",
  },
  {
    id: "if-then",
    marker: "02",
    category: "НЕ ЗАБЫТЬ",
    title: "Составь план «если — то»",
    description: "Заранее свяжи конкретную ситуацию с конкретным действием. Тогда в нужный момент тебе не придётся снова принимать решение.",
    example: "«Когда поставлю чашку после завтрака, налью воду» или «когда лягу в кровать, прочитаю одну страницу».",
    takeaway: "Чем точнее сигнал, тем легче узнать момент для действия.",
  },
  {
    id: "stable-cue",
    marker: "03",
    category: "НЕ ЗАБЫТЬ",
    title: "Оставь привычке знакомый якорь",
    description: "Повторяй действие после одного и того же события или в похожей обстановке: после завтрака, по возвращении домой, у рабочего стола.",
    example: "Не просто «медитировать каждый день», а «садиться на подушку после того, как закрою ноутбук».",
    takeaway: "Стабильный контекст постепенно сам начинает напоминать.",
  },
  {
    id: "prepare",
    marker: "04",
    category: "НАЧАТЬ",
    title: "Убери одно препятствие заранее",
    description: "Сделай полезное действие самым лёгким из доступных: подготовь нужные вещи вечером и положи их туда, где начнётся привычка.",
    example: "Кроссовки — у двери, бутылка — на столе, книга — на подушке, коврик — уже разложен.",
    takeaway: "Иногда устойчивость начинается не с мотивации, а с удобства.",
  },
  {
    id: "temptation-bundle",
    marker: "05",
    category: "ПРОДОЛЖИТЬ",
    title: "Соедини полезное с приятным",
    description: "Добавь к действию небольшое удовольствие, которое доступно именно во время привычки. Так награда перестаёт быть слишком далёкой.",
    example: "Любимый подкаст — только на прогулке; уютный чай — во время планирования недели; сериал — пока складываешь вещи.",
    takeaway: "Выбирай сочетание, которое не мешает самому действию.",
  },
  {
    id: "mark-now",
    marker: "06",
    category: "ПРОДОЛЖИТЬ",
    title: "Отмечай шаг сразу",
    description: "Не откладывай фиксацию на вечер. Видимая отметка помогает заметить реальный прогресс и связывает действие с быстрым чувством завершённости.",
    example: "Сделала минимальный шаг — сразу поставь галочку и посмотри, как изменилось растение.",
    takeaway: "Записывай сделанное, а не только идеальные дни.",
  },
  {
    id: "gentle-return",
    marker: "07",
    category: "ПРОДОЛЖИТЬ",
    title: "После пропуска не наверстывай",
    description: "Один пропуск не стирает сформированную связь. Вместо наказания вернись к обычной или минимальной версии при следующей подходящей возможности.",
    example: "Не получилось вчера — сегодня не нужно делать двойную прогулку. Достаточно снова надеть кроссовки.",
    takeaway: "Устойчивость — это способность вернуться, а не неуязвимость.",
  },
  {
    id: "immediate-joy",
    marker: "08",
    category: "НАЧАТЬ",
    title: "Спроси: как сделать это приятнее сейчас?",
    description: "Далёкая польза помогает выбрать цель, но продолжать часто легче, когда в самом процессе есть комфорт, интерес или удовольствие.",
    example: "Выбери красивый маршрут, удобный темп, любимую ручку, солнечное место или формат, который тебе действительно нравится.",
    takeaway: "Хорошая привычка не обязана ощущаться наказанием.",
  },
];

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
  peony: [
    "Семечко пиона ждёт в земле", "Появляется первый корешок", "Росток освобождается от оболочки", "Изогнутый росток тянется вверх", "Раскрываются две семядоли",
    "Появляется первый настоящий лист", "Первый лист разворачивается", "Растёт вторая пара листьев", "Стебелёк становится крепче", "Листья приобретают резную форму",
    "Появляется новый листовой ярус", "Росток становится гуще", "У основания намечается второй побег", "Молодой кустик ветвится", "Листьев становится заметно больше",
    "Боковые побеги вытягиваются", "Куст пиона округляется", "Листовая крона становится плотнее", "На верхушке появляется бутон", "Бутон поднимается над листьями",
    "Чашелистики начинают расходиться", "Бутон набирает розовый цвет", "Показываются первые лепестки", "Бутон становится мягче и круглее", "Наружные лепестки раскрываются",
    "Цветок раскрывается на четверть", "Пион раскрыт наполовину", "Лепестки образуют пышную чашу", "Цветок почти полностью распустился", "Пион пышно расцвёл",
  ],
  sakura: [
    "Косточка сакуры ждёт пробуждения", "Косточка раскрывается", "Появляется первый корень", "Корешок закрепляется в земле", "Побег выходит из косточки",
    "Росток распрямляется", "Раскрываются семядоли", "Появляется первый настоящий лист", "Растёт вторая пара листьев", "Стволик начинает крепнуть",
    "Листья становятся длиннее", "Саженец тянется вверх", "Появляется первая боковая веточка", "Формируется вторая ветвь", "Ствол приобретает древесный оттенок",
    "Ветви расходятся в стороны", "Крона начинает округляться", "Появляются веточки второго порядка", "На ветвях формируются почки", "Почек становится заметно больше",
    "Почки набухают", "На почках появляется розовый цвет", "Первая почка раскрывается", "Распускаются несколько цветков", "Цветение расходится по ветвям",
    "Крона становится нежно-розовой", "Цветков становится всё больше", "Сакура почти полностью в цвету", "Крона покрывается лепестками", "Сакура пышно расцвела",
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

function monthlySupportMessage(totalCompleted: number, rate: number) {
  if (totalCompleted === 0) return "Этот месяц пока как чистая грядка. Первая отметка уже будет настоящим началом.";
  if (rate >= 80) return "В этом месяце у сада был очень устойчивый ритм. Ты много раз выбирала то, что для тебя важно.";
  if (rate >= 50) return "Ритм был живым: где-то уверенным, где-то с паузами. Сделанное всё равно осталось с тобой.";
  return "Даже неровный месяц состоит из настоящих шагов. Здесь хорошо видно всё, что у тебя уже получилось.";
}

function completionDateLabel(value: string | null) {
  if (!value) return "Дата сохранится после 30-го шага";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function latestGoalDateLabel(plant: PlantHabit) {
  const latestDate = [...plant.completionDates, ...plant.continuationDates].sort().at(-1);
  return completionDateLabel(latestDate ? `${latestDate}T12:00:00.000Z` : plant.completedAt);
}

function getSpecies(code: SpeciesCode) {
  return species.find((item) => item.code === code) ?? species[0];
}

function frameFor(plant: PlantHabit) {
  return Math.min(TOTAL_STAGES - 1, Math.max(0, completedDaysFor(plant)));
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

function PlantArt({ plant, effect, decoration, className = "" }: { plant: PlantHabit; effect?: CareEffect; decoration?: DecorationCode; className?: string }) {
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
      {decoration === "sign" && <span className={styles.gardenSign} aria-hidden="true"><i>расти<br />бережно</i></span>}
      {decoration === "lantern" && <span className={styles.gardenLantern} aria-hidden="true"><i /></span>}
      {decoration === "stones" && <span className={styles.stonePath} aria-hidden="true"><i /><i /><i /><i /></span>}
      {effect === "fertilizer" && <span className={styles.fertilizerDust} aria-hidden="true">✦ ✧ ✦</span>}
      {effect === "kind" && <span className={styles.kindHearts} aria-hidden="true">♡ ♡ ♡</span>}
      {effect === "upgrade" && <span className={styles.upgradeGlow} aria-hidden="true">✦</span>}
    </div>
  );
}

export default function LivingPlantsPrototype() {
  const [plants, setPlants] = useState(initialPlants);
  const [selectedId, setSelectedId] = useState(initialPlants[0].id);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [effect, setEffect] = useState<{ plantId: string; kind: CareEffect } | null>(null);
  const [showDecorationPicker, setShowDecorationPicker] = useState(false);
  const [claimedAchievements, setClaimedAchievements] = useState<string[]>([]);
  const [purchases, setPurchases] = useState<LivingPurchase[]>([]);
  const [showPlanting, setShowPlanting] = useState(false);
  const [completionCelebration, setCompletionCelebration] = useState<PlantHabit | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"checking" | "signed-out" | "connected" | "offline">("checking");
  const [accountName, setAccountName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [newHabit, setNewHabit] = useState("Утренняя разминка");
  const [newSpecies, setNewSpecies] = useState<SpeciesCode>("apple");
  const [newFrequency, setNewFrequency] = useState<Frequency>("daily");
  const [newGoalDays, setNewGoalDays] = useState(30);
  const [newReminder, setNewReminder] = useState<string | null>("09:00");
  const [activeView, setActiveView] = useState<"garden" | "successes" | "statistics" | "tips">("garden");
  const [statisticsMonth, setStatisticsMonth] = useState(() => livingMonthKey());
  const carouselTouchStart = useRef<number | null>(null);

  const snapshot = useMemo<LivingGardenSnapshot>(() => ({ version: LIVING_GARDEN_VERSION, plants, claimedAchievements, purchases }), [claimedAchievements, plants, purchases]);
  const points = livingGardenPoints(snapshot);
  const unlockedSpecies = unlockedLivingSpecies(snapshot);
  const decorationsByPlant = livingDecorations(snapshot);
  const today = livingDateKey();
  const currentMonth = livingMonthKey();
  const monthlyStatistics = useMemo(() => buildMonthlyGardenStatistic(plants, statisticsMonth, today), [plants, statisticsMonth, today]);
  const maximumWeeklyActions = Math.max(1, ...monthlyStatistics.weeks.map((week) => week.completed));
  const activePlants = plants.filter((plant) => habitDaysFor(plant) < plant.goalDays);
  const completedPlants = plants
    .filter((plant) => Boolean(plant.completedAt))
    .sort((left, right) => (right.completedAt ?? right.updatedAt).localeCompare(left.completedAt ?? left.updatedAt));
  const savedSuccessActions = completedPlants.reduce((sum, plant) => sum + Math.max(0, ...plant.rewardedGoals), 0);
  const savedSuccessRewards = completedPlants.reduce((sum, plant) => sum + plant.rewardedGoals.length * LIVING_COMPLETION_REWARD, 0);
  const selected = plants.find((plant) => plant.id === selectedId) ?? plants[0];
  const carouselPlants = activePlants.some((plant) => plant.id === selected.id) ? activePlants : plants;
  const selectedCarouselIndex = Math.max(0, carouselPlants.findIndex((plant) => plant.id === selected.id));
  const previousCarouselPlant = carouselPlants.length > 1 ? carouselPlants[(selectedCarouselIndex - 1 + carouselPlants.length) % carouselPlants.length] : null;
  const nextCarouselPlant = carouselPlants.length > 1 ? carouselPlants[(selectedCarouselIndex + 1) % carouselPlants.length] : null;
  const selectedSpecies = getSpecies(selected.species);
  const selectedFrame = frameFor(selected);
  const todayPlants = plants.filter((plant) => habitDaysFor(plant) < plant.goalDays || plant.completionDates.includes(today) || plant.continuationDates.includes(today));
  const finishedToday = todayPlants.filter((plant) => plant.completionDates.includes(today) || plant.continuationDates.includes(today)).length;
  const streak = livingGardenActivityStreak(plants, today);
  const longestStreak = livingGardenLongestActivityStreak(plants);
  const maxCompletedDays = Math.max(0, ...plants.map(completedDaysFor));
  const totalConfirmedActions = plants.reduce((sum, plant) => sum + livingHabitDates(plant).length, 0);
  const successfulPlantsCount = completedPlants.length;
  const distinctSpeciesCount = new Set(plants.map((plant) => plant.species)).size;
  const decoratedPlantsCount = new Set(purchases.filter((purchase) => purchase.kind === "decoration").map((purchase) => purchase.plantId).filter(Boolean)).size;
  const longestConfirmedGoal = Math.max(0, ...plants.flatMap((plant) => plant.rewardedGoals));
  const earnedAchievementIds = new Set(livingGardenAchievementIds(snapshot));
  const dailyAchievements = [
    { id: `daily:one:${today}`, icon: "☀", title: "Первый шаг дня", description: "Подтверди хотя бы одну привычку сегодня", progress: `${Math.min(1, finishedToday)}/1` },
    { id: `daily:three:${today}`, icon: "☘", title: "Три ростка за день", description: "Поддержи сегодня три разных растения", progress: `${Math.min(3, finishedToday)}/3` },
    { id: `daily:five:${today}`, icon: "✦", title: "Сад в полном цвету", description: "Сделай пять отметок за один день", progress: `${Math.min(5, finishedToday)}/5` },
  ].map((item) => ({ ...item, reward: livingAchievementReward(item.id), earned: earnedAchievementIds.has(item.id) }));
  const globalAchievements = [
    { id: "first-roots", icon: "❧", title: "Крепкие корни", description: "Доведи любое растение до 20-го этапа", progress: `${Math.min(20, maxCompletedDays)}/20` },
    { id: "streak-three", icon: "≈", title: "Ритм найден", description: "Возвращайся в сад 3 дня подряд", progress: `${Math.min(3, longestStreak)}/3` },
    { id: "streak-ten", icon: "✦", title: "Десять дней рядом", description: "Поддерживай ритм 10 дней подряд", progress: `${Math.min(10, longestStreak)}/10` },
    { id: "actions-ten", icon: "10", title: "Первые десять шагов", description: "Сделай 10 подтверждённых отметок", progress: `${Math.min(10, totalConfirmedActions)}/10` },
    { id: "actions-thirty", icon: "30", title: "Месяц живых действий", description: "Сделай 30 подтверждённых отметок", progress: `${Math.min(30, totalConfirmedActions)}/30` },
    { id: "actions-hundred", icon: "100", title: "Сотня добрых шагов", description: "Собери 100 настоящих выполнений", progress: `${Math.min(100, totalConfirmedActions)}/100` },
    { id: "first-success", icon: "♕", title: "Первое взрослое растение", description: "Заверши первый выбранный срок", progress: `${Math.min(1, successfulPlantsCount)}/1` },
    { id: "three-successes", icon: "♕", title: "Сад достижений", description: "Сохрани три взрослых растения", progress: `${Math.min(3, successfulPlantsCount)}/3` },
    { id: "four-species", icon: "❉", title: "Ботаническое разнообразие", description: "Посади четыре разных вида", progress: `${Math.min(4, distinctSpeciesCount)}/4` },
    { id: "long-path", icon: "∞", title: "Глубокие корни", description: "Продолжи одну привычку до 60 отметок", progress: `${Math.min(60, longestConfirmedGoal)}/60` },
    { id: "garden-decorator", icon: "⌂", title: "Хранитель сада", description: "Укрась три разных растения", progress: `${Math.min(3, decoratedPlantsCount)}/3` },
  ].map((item) => ({ ...item, reward: livingAchievementReward(item.id), earned: earnedAchievementIds.has(item.id) }));

  useEffect(() => {
    let cancelled = false;
    const restoreAndConnect = async () => {
      await Promise.resolve();
      let localSnapshot = initialSnapshot;
      try {
        const saved = localStorage.getItem(LIVING_GARDEN_STORAGE_KEY);
        const restored = saved ? sanitizeLivingGardenSnapshot(JSON.parse(saved)) : null;
        if (restored) localSnapshot = mergeLivingGardenSnapshots(initialSnapshot, restored);
      } catch {
        // The starter garden remains available when local storage is unavailable.
      }
      if (cancelled) return;
      setPlants(localSnapshot.plants);
      setClaimedAchievements(localSnapshot.claimedAchievements);
      setPurchases(localSnapshot.purchases);
      setHydrated(true);

      try {
        const response = await fetch("/api/living-garden", { headers: { Accept: "application/json" } });
        if (response.status === 401) {
          if (!cancelled) setSyncStatus("signed-out");
          return;
        }
        if (!response.ok) throw new Error("Cloud sync unavailable");
        const data = await response.json() as { user?: { displayName?: string }; snapshot?: unknown; syncedAt?: string | null };
        const remote = sanitizeLivingGardenSnapshot(data.snapshot);
        const merged = remote ? mergeLivingGardenSnapshots(localSnapshot, remote) : localSnapshot;
        if (cancelled) return;
        setPlants(merged.plants);
        setClaimedAchievements(merged.claimedAchievements);
        setPurchases(merged.purchases);
        setAccountName(data.user?.displayName ?? "Садовник");
        setSyncedAt(data.syncedAt ?? null);
        setSyncStatus("connected");
        setCloudReady(true);
      } catch {
        if (!cancelled) setSyncStatus("offline");
      }
    };
    void restoreAndConnect();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LIVING_GARDEN_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // The garden remains usable for the current session when storage is blocked.
    }
  }, [hydrated, snapshot]);

  useEffect(() => {
    if (!cloudReady || syncStatus !== "connected") return;
    const timeout = window.setTimeout(() => {
      setIsSaving(true);
      fetch("/api/living-garden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      }).then(async (response) => {
        if (response.status === 401) {
          setSyncStatus("signed-out");
          return;
        }
        if (!response.ok) throw new Error("Cloud sync unavailable");
        const data = await response.json() as { snapshot?: unknown; syncedAt?: string };
        const remote = sanitizeLivingGardenSnapshot(data.snapshot);
        if (remote && JSON.stringify(remote) !== JSON.stringify(snapshot)) {
          const merged = mergeLivingGardenSnapshots(snapshot, remote);
          setPlants(merged.plants);
          setClaimedAchievements(merged.claimedAchievements);
          setPurchases(merged.purchases);
        }
        setSyncedAt(data.syncedAt ?? new Date().toISOString());
      }).catch(() => setSyncStatus("offline")).finally(() => setIsSaving(false));
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [cloudReady, snapshot, syncStatus]);

  function showCareEffect(plantId: string, kind: CareEffect) {
    setEffect({ plantId, kind });
    window.setTimeout(() => setEffect((current) => current?.plantId === plantId && current.kind === kind ? null : current), 1800);
  }

  function completePlant(plantId: string) {
    const plant = plants.find((item) => item.id === plantId);
    if (!plant) return;
    setSelectedId(plantId);
    if (plant.completionDates.includes(today) || plant.continuationDates.includes(today) || habitDaysFor(plant) >= plant.goalDays) return;

    const isGrowing = completedDaysFor(plant) < TOTAL_STAGES;
    const saveCompletion = () => {
      const updatedAt = new Date().toISOString();
      const nextCompletionDates = isGrowing ? [...new Set([...plant.completionDates, today])].sort() : plant.completionDates;
      const nextContinuationDates = isGrowing ? plant.continuationDates : [...new Set([...plant.continuationDates, today])].sort();
      const nextHabitDays = Math.min(plant.goalDays, plant.baseCompletedDays + nextCompletionDates.length + nextContinuationDates.length);
      const reachedGoal = nextHabitDays >= plant.goalDays;
      const reachedMaturity = completedDaysFor(plant) < TOTAL_STAGES && plant.baseCompletedDays + nextCompletionDates.length >= TOTAL_STAGES;
      const completedPlant = {
        ...plant,
        completionDates: nextCompletionDates,
        continuationDates: nextContinuationDates,
        rewardedGoals: reachedGoal ? [...new Set([...plant.rewardedGoals, plant.goalDays])].sort((a, b) => a - b) : plant.rewardedGoals,
        completedAt: plant.completedAt ?? (reachedGoal ? updatedAt : null),
        updatedAt,
      };
      setPlants((current) => current.map((item) => item.id === plantId
        ? completedPlant
        : item));
      setMessages((current) => ({
        ...current,
        [plantId]: reachedGoal
          ? `Ты прошла выбранный путь — ${plant.goalDays} настоящих шагов. Этот успех уже сохранён, а дальше решать только тебе.`
          : reachedMaturity
            ? `Растение стало взрослым. Теперь ты продолжаешь не ради картинки, а чтобы действию становилось всё легче находить место в твоей жизни.`
            : isGrowing
              ? praiseMessages[(completedDaysFor(plant) + 1) % praiseMessages.length]
              : `Ещё одно повторение укрепляет знакомый ритм. Уже ${nextHabitDays} из ${plant.goalDays} шагов.`,
      }));
      if (reachedGoal) setCompletionCelebration(completedPlant);
    };

    if (isGrowing) {
      setEffect({ plantId, kind: "growOut" });
      window.setTimeout(() => {
        saveCompletion();
        setEffect({ plantId, kind: "growIn" });
        window.setTimeout(() => setEffect((current) => current?.plantId === plantId && current.kind === "growIn" ? null : current), 820);
      }, 430);
    } else {
      saveCompletion();
      showCareEffect(plantId, "upgrade");
    }
  }

  function extendHabit(plantId: string) {
    const plant = plants.find((item) => item.id === plantId);
    if (!plant || habitDaysFor(plant) < plant.goalDays) return;
    const nextGoal = Math.min(MAX_GOAL_DAYS, plant.goalDays + 30);
    setPlants((current) => current.map((item) => item.id === plantId ? { ...item, goalDays: nextGoal, updatedAt: new Date().toISOString() } : item));
    setSelectedId(plantId);
    setActiveView("garden");
    setCompletionCelebration(null);
    setMessages((current) => ({ ...current, [plantId]: `Твой успех никуда не исчез. Теперь начинается спокойное закрепление до ${nextGoal} отметок — без требования быть идеальной.` }));
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
    setPurchases((current) => [...current, { id: crypto.randomUUID(), kind: "care", target: "fertilizer", price: FERTILIZER_PRICE, createdAt: new Date().toISOString() }]);
    setMessages((current) => ({ ...current, [selected.id]: "Удобрение добавлено. Ты бережно заботишься о саде — и это тоже заслуживает похвалы." }));
    showCareEffect(selected.id, "fertilizer");
  }

  function chooseDecoration(code: DecorationCode, price: number, name: string) {
    if (decorationsByPlant[selected.id] === code) {
      setMessages((current) => ({ ...current, [selected.id]: `${name} уже украшает это растение.` }));
      setShowDecorationPicker(false);
      return;
    }
    if (points < price) {
      setMessages((current) => ({ ...current, [selected.id]: `Для украшения «${name}» нужно ещё ${price - points} ✦. Каждая выполненная привычка приносит 10 ✦.` }));
      return;
    }
    setPurchases((current) => [...current, { id: crypto.randomUUID(), kind: "decoration", target: code, plantId: selected.id, price, createdAt: new Date().toISOString() }]);
    setMessages((current) => ({ ...current, [selected.id]: `${name} появилось рядом прямо сейчас. Вот во что превращается твоё постоянство.` }));
    setShowDecorationPicker(false);
    showCareEffect(selected.id, "upgrade");
  }

  function unlockPlant(item: Species) {
    if (!item.unlockPrice || unlockedSpecies.includes(item.code)) {
      setNewSpecies(item.code);
      setShowPlanting(true);
      return;
    }
    if (points < item.unlockPrice) return;
    setPurchases((current) => [...current, { id: crypto.randomUUID(), kind: "species", target: item.code, price: item.unlockPrice!, createdAt: new Date().toISOString() }]);
    setNewSpecies(item.code);
    setShowPlanting(true);
    setMessages((current) => ({ ...current, [selected.id]: `${item.name} теперь доступна в твоём саду. Ты открыла её благодаря регулярным шагам.` }));
  }

  function updateSelected(patch: Partial<Pick<PlantHabit, "frequency" | "reminder">>) {
    setPlants((current) => current.map((plant) => plant.id === selected.id ? { ...plant, ...patch, updatedAt: new Date().toISOString() } : plant));
  }

  function movePlantCarousel(direction: -1 | 1) {
    if (carouselPlants.length < 2) return;
    const currentIndex = Math.max(0, carouselPlants.findIndex((plant) => plant.id === selected.id));
    const nextIndex = (currentIndex + direction + carouselPlants.length) % carouselPlants.length;
    setSelectedId(carouselPlants[nextIndex].id);
    setShowDecorationPicker(false);
  }

  function plantNewHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    const plant: PlantHabit = {
      id: crypto.randomUUID(),
      habit: name,
      species: newSpecies,
      baseCompletedDays: 0,
      completionDates: [],
      continuationDates: [],
      goalDays: newGoalDays,
      rewardedGoals: [],
      frequency: newFrequency,
      reminder: newReminder,
      createdAt: new Date().toISOString(),
      completedAt: null,
      updatedAt: new Date().toISOString(),
    };
    setPlants((current) => [...current, plant]);
    setSelectedId(plant.id);
    setMessages((current) => ({ ...current, [plant.id]: "Какой хороший выбор. Здесь начинается новая история — с семечка и твоего первого бережного шага." }));
    setShowPlanting(false);
  }

  function signOut() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => window.location.reload());
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
          {syncStatus === "signed-out" ? (
            <button className={styles.syncButton} onClick={() => setShowAuth(true)}><b>☁</b><span>Войти и синхронизировать</span></button>
          ) : syncStatus === "connected" ? (
            <span className={styles.accountBadge} title={syncedAt ? `Последняя синхронизация: ${new Date(syncedAt).toLocaleString("ru-RU")}` : "Облачный сад подключён"}><b>☁</b><span>{accountName} · {isSaving ? "сохраняю…" : "синхронизировано"}</span><button onClick={signOut}>Выйти</button></span>
          ) : syncStatus === "offline" ? (
            <button className={styles.syncButton} onClick={() => window.location.reload()}><b>◌</b><span>На устройстве · повторить</span></button>
          ) : <span className={styles.syncChecking}>Подключаю сад…</span>}
          <span className={styles.pointsBadge}>✦ <b>{points}</b> очков</span>
          <Link className={styles.backLink} href="/garden-prototype">Открыть 3D-сад</Link>
        </nav>
      </header>

      <nav className={styles.viewTabs} aria-label="Разделы сада" role="tablist">
        <button type="button" role="tab" aria-selected={activeView === "garden"} className={activeView === "garden" ? styles.activeViewTab : ""} onClick={() => setActiveView("garden")}><span>❧</span> Мой сад</button>
        <button type="button" role="tab" aria-selected={activeView === "successes"} className={activeView === "successes" ? styles.activeViewTab : ""} onClick={() => setActiveView("successes")}><span>♕</span> Сад успехов <b>{completedPlants.length}</b></button>
        <button type="button" role="tab" aria-selected={activeView === "statistics"} className={activeView === "statistics" ? styles.activeViewTab : ""} onClick={() => setActiveView("statistics")}><span>◫</span> Статистика</button>
        <button type="button" role="tab" aria-selected={activeView === "tips"} className={activeView === "tips" ? styles.activeViewTab : ""} onClick={() => setActiveView("tips")}><span>✦</span> Подсказки</button>
      </nav>

      {activeView === "garden" ? <>
      <section className={styles.workspace} aria-label="Мой сад сегодня">
        <aside className={styles.habitsPanel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.eyebrow}>МОЙ САД · СЕГОДНЯ</span><h1>Что будем растить?</h1></div>
            <b>{finishedToday}/{todayPlants.length}</b>
          </div>

          <blockquote className={styles.dailyMessage}>
            <span>Послание на сегодня</span>
            <p>«{dailyQuote}»</p>
            <small>бережная оценка «Рост»</small>
          </blockquote>

          <div className={styles.habitList}>
            {activePlants.map((plant) => {
              const itemSpecies = getSpecies(plant.species);
              const checked = plant.completionDates.includes(today) || plant.continuationDates.includes(today);
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
                    <small>{itemSpecies.name} · {frequencyLabels[plant.frequency]} · цель {plant.goalDays}</small>
                    <strong>{plant.habit}</strong>
                    <em>{plant.reminder ? `Напомнить в ${plant.reminder}` : "Без напоминания"}</em>
                  </span>
                  <span className={styles.rowStage}>{completedDaysFor(plant) >= TOTAL_STAGES ? habitDaysFor(plant) : frameFor(plant) + 1}<small>/{completedDaysFor(plant) >= TOTAL_STAGES ? plant.goalDays : 30}</small></span>
                </button>
              );
            })}
            {!activePlants.length && <div className={styles.allHabitsComplete}><span>♕</span><b>Все посаженные циклы завершены</b><p>Взрослые растения ждут тебя в Саду успехов. Можно спокойно посадить новую привычку.</p><button type="button" onClick={() => setActiveView("successes")}>Посмотреть успехи</button></div>}
          </div>

          <button className={styles.addHabit} onClick={() => setShowPlanting(true)}><span>＋</span><b>Посадить новую привычку</b></button>
        </aside>

        <article className={`${styles.plantStage} ${effect?.plantId === selected.id ? styles.celebrating : ""}`} style={{ "--accent": selectedSpecies.accent } as CSSProperties}>
          <div className={styles.stageTop}>
            <div><span className={styles.eyebrow}>{selectedSpecies.family} · {selectedSpecies.name}</span><h2>{selected.habit}</h2></div>
            <div className={styles.stageCounter}><span>{selectedFrame + 1 >= TOTAL_STAGES ? "закрепление" : "этап"}</span><b>{selectedFrame + 1 >= TOTAL_STAGES ? habitDaysFor(selected) : selectedFrame + 1}</b><small>из {selectedFrame + 1 >= TOTAL_STAGES ? selected.goalDays : 30}</small></div>
          </div>

          <div
            className={styles.plantScene}
            role="region"
            aria-roledescription="карусель"
            aria-label="Растения привычек"
            onTouchStart={(event) => { carouselTouchStart.current = event.changedTouches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              const start = carouselTouchStart.current;
              carouselTouchStart.current = null;
              if (start === null) return;
              const distance = (event.changedTouches[0]?.clientX ?? start) - start;
              if (Math.abs(distance) >= 45) movePlantCarousel(distance < 0 ? 1 : -1);
            }}
          >
            <span className={styles.sunGlow} aria-hidden="true" />
            {previousCarouselPlant && (
              <button
                type="button"
                className={`${styles.carouselPeek} ${styles.carouselPrevious}`}
                onClick={() => movePlantCarousel(-1)}
                aria-label={`Предыдущее растение: ${previousCarouselPlant.habit}`}
              >
                <PlantArt plant={previousCarouselPlant} decoration={decorationsByPlant[previousCarouselPlant.id]} />
                <span className={styles.carouselArrow} aria-hidden="true">‹</span>
                <strong>{previousCarouselPlant.habit}</strong>
              </button>
            )}
            <div key={selected.id} className={styles.carouselCurrent}>
              <PlantArt plant={selected} effect={effect?.plantId === selected.id ? effect.kind : undefined} decoration={decorationsByPlant[selected.id]} />
            </div>
            {nextCarouselPlant && (
              <button
                type="button"
                className={`${styles.carouselPeek} ${styles.carouselNext}`}
                onClick={() => movePlantCarousel(1)}
                aria-label={`Следующее растение: ${nextCarouselPlant.habit}`}
              >
                <PlantArt plant={nextCarouselPlant} decoration={decorationsByPlant[nextCarouselPlant.id]} />
                <span className={styles.carouselArrow} aria-hidden="true">›</span>
                <strong>{nextCarouselPlant.habit}</strong>
              </button>
            )}
            {carouselPlants.length > 1 && <span className={styles.carouselPosition}>{selectedCarouselIndex + 1} из {carouselPlants.length}</span>}
            <div className={styles.growthCaption}><span>Сейчас происходит</span><strong>{selectedFrame + 1 >= TOTAL_STAGES && habitDaysFor(selected) < selected.goalDays ? `Взрослое растение · привычка закрепляется, ${habitDaysFor(selected)} из ${selected.goalDays}` : growthDescriptions[selected.species][selectedFrame]}</strong></div>
          </div>

          <div className={styles.careDock}>
            <div className={styles.careDockHeading}><span><b>Тёплая забота</b><small>эффект виден прямо на растении</small></span><strong>✦ {points}</strong></div>
            <div className={styles.careDockActions}>
              <button onClick={sayKindWord}><span>♡</span><b>Доброе слово</b><small>бесплатно</small></button>
              <button onClick={nourish} disabled={points < FERTILIZER_PRICE}><span>✦</span><b>Удобрить</b><small>{FERTILIZER_PRICE} ✦</small></button>
              <button onClick={() => setShowDecorationPicker((current) => !current)}><span>⌂</span><b>Украсить</b><small>от 40 ✦</small></button>
            </div>
            {showDecorationPicker && (
              <div className={styles.decorationPicker}>
                {decorations.map((item) => (
                  <button key={item.code} onClick={() => chooseDecoration(item.code, item.price, item.name)} disabled={points < item.price && decorationsByPlant[selected.id] !== item.code}>
                    <span>{item.icon}</span><b>{item.name}</b><small>{decorationsByPlant[selected.id] === item.code ? "уже в саду" : `${item.price} ✦ · ${item.detail}`}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.liveMessage} aria-live="polite">
            <span>“</span>
            <p>{messages[selected.id] ?? "Ты уже начала. Нажми на привычку слева — галочка сохранится, а я сразу покажу тебе следующий настоящий этап роста."}</p>
          </div>

          <div className={styles.monthBlock}>
            <div className={styles.monthHeading}><span>30 отметок роста</span><b>{completedDaysFor(selected)} выполнено</b></div>
            <div className={styles.dayDots} aria-label={`${completedDaysFor(selected)} выполнений из 30`}>
              {Array.from({ length: TOTAL_STAGES }, (_, index) => (
                <i key={index} className={`${index < completedDaysFor(selected) ? styles.filledDay : ""} ${index === completedDaysFor(selected) ? styles.nextDay : ""}`}>{index + 1}</i>
              ))}
            </div>
            {selected.goalDays > TOTAL_STAGES && <div className={styles.continuationProgress}><span><b>Закрепление привычки</b><small>{habitDaysFor(selected)} из {selected.goalDays} отметок</small></span><i><b style={{ width: `${Math.min(100, habitDaysFor(selected) / selected.goalDays * 100)}%` }} /></i></div>}
          </div>

          {habitDaysFor(selected) >= selected.goalDays ? (
            <div className={styles.completedPlantNotice}><span>♕</span><div><b>Цель в {selected.goalDays} отметок завершена</b><small>{latestGoalDateLabel(selected)} · успех сохранён</small></div><div className={styles.completedNoticeActions}>{selected.goalDays < MAX_GOAL_DAYS && <button type="button" onClick={() => extendHabit(selected.id)}>Продолжить ещё 30</button>}<button type="button" onClick={() => setActiveView("successes")}>Сад успехов</button></div></div>
          ) : (
            <div className={styles.scheduleSettings}>
              <label><span>Ритм привычки</span><select value={selected.frequency} onChange={(event) => updateSelected({ frequency: event.target.value as Frequency })}><option value="daily">Каждый день</option><option value="threeWeekly">3 раза в неделю</option><option value="weekly">Раз в неделю</option></select></label>
              <label><span>Напоминание</span><select value={selected.reminder ?? "off"} onChange={(event) => updateSelected({ reminder: event.target.value === "off" ? null : event.target.value })}><option value="off">Не напоминать</option><option value="09:00">В 09:00</option><option value="18:30">В 18:30</option><option value="21:30">В 21:30</option></select></label>
            </div>
          )}
        </article>
      </section>

      <section className={styles.gardenSection} id="garden">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>РАСТЕНИЯ В МОЁМ САДУ</span><h2>У каждой привычки — свой живой характер</h2></div><p>Нажми на растение, чтобы посмотреть его календарь и рост.</p></div>
        <div className={styles.plantShelf}>
          {plants.map((plant) => {
            const itemSpecies = getSpecies(plant.species);
            return (
              <button key={plant.id} className={`${styles.shelfPlant} ${plant.id === selected.id ? styles.selectedShelfPlant : ""}`} style={{ "--accent": itemSpecies.accent } as CSSProperties} onClick={() => setSelectedId(plant.id)}>
                {plant.completedAt && <i className={styles.completedBadge}>♕ успех сохранён</i>}
                <PlantArt plant={plant} />
                <span><small>{itemSpecies.name}</small><strong>{plant.habit}</strong><em>{completedDaysFor(plant) >= TOTAL_STAGES ? `${habitDaysFor(plant)}/${plant.goalDays} · ${plant.completedAt ? "в Саду успехов" : "закрепление"}` : `${frameFor(plant) + 1} этап`}</em></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.supportGrid}>
        <article className={styles.achievementsCard}>
          <div className={styles.cardHeading}><div><span className={styles.eyebrow}>ДОСТИЖЕНИЯ САДА</span><h2>Каждое усилие замечено</h2></div><b>начисляются сами ✦</b></div>
          <div className={styles.achievementGroupHeading}><span>СЕГОДНЯ</span><p>Каждый новый день — новая возможность получить эти награды.</p></div>
          <div className={`${styles.achievementGrid} ${styles.dailyAchievementGrid}`}>
            {dailyAchievements.map((item) => (
                <article key={item.id} className={`${styles.achievement} ${styles.dailyAchievement} ${item.earned ? styles.achievementClaimed : ""}`}>
                  <span>{item.icon}</span><div><b>{item.title}</b><p>{item.description}</p><small>{item.earned ? "Начислено автоматически" : item.progress}</small></div>
                  <strong className={styles.automaticReward}>{item.earned ? <><span>✓</span><small>+{item.reward} ✦</small></> : `+${item.reward} ✦`}</strong>
                </article>
            ))}
          </div>
          <div className={styles.achievementGroupHeading}><span>ЗА ВЕСЬ ПУТЬ</span><p>Глобальные достижения остаются с садом навсегда.</p></div>
          <div className={styles.achievementGrid}>
            {globalAchievements.map((item) => (
              <article key={item.id} className={`${styles.achievement} ${item.earned ? styles.achievementClaimed : ""}`}>
                <span>{item.icon}</span><div><b>{item.title}</b><p>{item.description}</p><small>{item.earned ? "Начислено автоматически" : item.progress}</small></div>
                <strong className={styles.automaticReward}>{item.earned ? <><span>✓</span><small>+{item.reward} ✦</small></> : `+${item.reward} ✦`}</strong>
              </article>
            ))}
          </div>
          {completedPlants.length > 0 && <div className={styles.savedSuccesses}><div><span>♕</span><b>Завершённые циклы</b><small>навсегда сохранены в твоём саду</small></div>{completedPlants.slice(0, 3).map((plant) => <button type="button" key={plant.id} onClick={() => { setSelectedId(plant.id); setActiveView("successes"); }}><strong>{plant.habit}</strong><span>{Math.max(...plant.rewardedGoals)} отметок · {completionDateLabel(plant.completedAt)}</span></button>)}</div>}
        </article>

        <article className={styles.rhythmCard}>
          <span className={styles.eyebrow}>ПОСТОЯНСТВО</span>
          <div className={styles.streakNumber}><b>{streak}</b><span>дней<br />бережного ритма</span></div>
          <div className={styles.rhythmBar}><i style={{ width: `${Math.min(100, streak * 8)}%` }} /></div>
          <strong>Ты не начинаешь сначала после сложного дня.</strong>
          <p>Ты продолжаешь с того места, где остановилась. Это и есть устойчивый рост.</p>
          <small>За достижения можно открывать редкие растения и украшения</small>
        </article>
      </section>

      <section className={styles.catalogSection}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ЛАВКА РЕДКОСТЕЙ</span><h2>Открывай растения за звёзды</h2></div><p>Обычные виды доступны сразу. Редкие пион и сакура открываются навсегда — и тоже растут через 30 настоящих стадий.</p></div>
        <div className={styles.catalogGrid}>
          {species.map((item) => {
            const preview: PlantHabit = { id: item.code, habit: item.name, species: item.code, baseCompletedDays: 29, completionDates: [], continuationDates: [], goalDays: 30, rewardedGoals: [], frequency: "daily", reminder: null, createdAt: INITIAL_UPDATED_AT, completedAt: null, updatedAt: INITIAL_UPDATED_AT };
            const unlocked = unlockedSpecies.includes(item.code);
            return <button key={item.code} className={!unlocked ? styles.lockedSpecies : ""} onClick={() => unlockPlant(item)} disabled={!unlocked && points < (item.unlockPrice ?? 0)} style={{ "--accent": item.accent } as CSSProperties}><PlantArt plant={preview} /><span><small>{item.family}</small><b>{item.name}</b><em>{unlocked ? item.character : `Открыть навсегда · ${item.unlockPrice} ✦`}</em></span>{!unlocked && <i className={styles.lockBadge}>редкое</i>}</button>;
          })}
        </div>
      </section>
      </> : activeView === "successes" ? (
        <section className={styles.successSection} role="tabpanel" aria-label="Сад моих успехов">
          <div className={styles.successHero}>
            <div><span className={styles.eyebrow}>САД МОИХ УСПЕХОВ</span><h1>Здесь остаётся всё, что ты вырастила</h1><p>Каждое взрослое растение — это не просто красивая картинка, а сохранённая история из 30 настоящих действий. Завершённые привычки больше не требуют отметок и навсегда остаются здесь.</p></div>
            <div className={styles.successSeal}><span>♕</span><b>{completedPlants.length}</b><small>{completedPlants.length === 1 ? "завершённый цикл" : "завершённых циклов"}</small></div>
          </div>

          <div className={styles.successSummary}>
            <article><span>Выращено</span><b>{completedPlants.length}</b><small>взрослых растений</small></article>
            <article><span>Сделано</span><b>{savedSuccessActions}</b><small>шагов в завершённых сроках</small></article>
            <article><span>Награды</span><b>+{savedSuccessRewards} ✦</b><small>за завершённые сроки</small></article>
          </div>

          {completedPlants.length ? (
            <div className={styles.successGardenGrid}>
              {completedPlants.map((plant) => {
                const plantSpecies = getSpecies(plant.species);
                return (
                  <article key={plant.id} className={styles.successPlantCard} style={{ "--accent": plantSpecies.accent } as CSSProperties}>
                    <div className={styles.successCrown}><span>♕</span><small>ДОСТИЖЕНИЕ СОХРАНЕНО</small></div>
                    <PlantArt plant={plant} decoration={decorationsByPlant[plant.id]} />
                    <div className={styles.successPlantCopy}><small>{plantSpecies.name} · подтверждено {Math.max(...plant.rewardedGoals)} дней</small><h2>{plant.habit}</h2><p>Ты возвращалась к этому шагу снова и снова — и вырастила целое растение. Успех сохранён, даже если ты решила продолжать.</p><div><span>{completionDateLabel(plant.completedAt)}</span><b>+{plant.rewardedGoals.length * LIVING_COMPLETION_REWARD} ✦</b></div><button type="button" onClick={() => { setSelectedId(plant.id); setActiveView("garden"); }}>{habitDaysFor(plant) >= plant.goalDays ? "Продолжить или посмотреть" : `Закрепляется · ${habitDaysFor(plant)}/${plant.goalDays}`}</button></div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptySuccessGarden}><span>❧</span><h2>Первое взрослое растение ещё впереди</h2><p>Когда любая привычка дойдёт до 30-й отметки, здесь появится её растение, дата завершения и сохранённая награда.</p><button type="button" onClick={() => setActiveView("garden")}>Вернуться к растениям</button></div>
          )}
        </section>
      ) : activeView === "statistics" ? (
        <section className={styles.statisticsSection} role="tabpanel" aria-label="Статистика сада за месяц">
          <div className={styles.statisticsHero}>
            <div>
              <span className={styles.eyebrow}>КАРТИНА МЕСЯЦА</span>
              <h1>Посмотрим, как ты росла</h1>
              <p>Здесь есть и выполненные дни, и паузы. Ничего не пропадает: каждый сделанный шаг остаётся частью общей картины.</p>
            </div>
            <div className={styles.monthPicker} aria-label="Выбрать месяц">
              <button type="button" onClick={() => setStatisticsMonth((month) => moveLivingMonth(month, -1))} aria-label="Предыдущий месяц">←</button>
              <strong>{livingMonthLabel(statisticsMonth)}</strong>
              <button type="button" onClick={() => setStatisticsMonth((month) => moveLivingMonth(month, 1))} disabled={statisticsMonth >= currentMonth} aria-label="Следующий месяц">→</button>
            </div>
          </div>

          <blockquote className={styles.monthlySummary}>
            <span>“</span>
            <p>{monthlySupportMessage(monthlyStatistics.totalCompleted, monthlyStatistics.rate)}</p>
          </blockquote>

          <div className={styles.statCards}>
            <article><span>Выполнено</span><b>{monthlyStatistics.totalCompleted}</b><small>подтверждённых действий</small></article>
            <article><span>Дни с заботой</span><b>{monthlyStatistics.activeDays}</b><small>из {monthlyStatistics.elapsedDays || monthlyStatistics.daysInMonth} прошедших дней</small></article>
            <article><span>Общий ритм</span><b>{monthlyStatistics.rate}%</b><small>от выбранного расписания</small></article>
            <article className={styles.gentleMissed}><span>Без отметки</span><b>{monthlyStatistics.missed}</b><small>это не отменяет сделанное</small></article>
          </div>

          <div className={styles.statisticsGrid}>
            <article className={styles.calendarCard}>
              <div className={styles.statCardHeading}><div><span className={styles.eyebrow}>КАЛЕНДАРЬ</span><h2>{livingMonthLabel(statisticsMonth)}</h2></div><small>цифра в кружке — сколько привычек выполнено</small></div>
              <div className={styles.weekdayRow} aria-hidden="true">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}</div>
              <div className={styles.monthCalendar}>
                {Array.from({ length: monthlyStatistics.calendarOffset }, (_, index) => <span className={styles.emptyCalendarDay} key={`empty-${index}`} />)}
                {monthlyStatistics.days.map((day) => (
                  <span
                    key={day.dateKey}
                    className={`${styles.statDay} ${day.completed ? styles.statDayDone : ""} ${day.isFuture ? styles.statDayFuture : ""} ${day.isToday ? styles.statDayToday : ""}`}
                    aria-label={`${day.day}: ${day.completed ? `${day.completed} выполнено` : day.isFuture ? "ещё впереди" : "без отметок"}`}
                  >
                    <b>{day.day}</b>
                    {day.completed > 0 ? <strong>{day.completed}</strong> : <i>{day.isFuture ? "" : "—"}</i>}
                  </span>
                ))}
              </div>
              <div className={styles.calendarLegend}><span><i className={styles.legendDone} />были действия</span><span><i />день без отметки</span><span><i className={styles.legendFuture} />ещё впереди</span></div>
            </article>

            <article className={styles.weekRhythmCard}>
              <div className={styles.statCardHeading}><div><span className={styles.eyebrow}>ПО НЕДЕЛЯМ</span><h2>Как менялся ритм</h2></div></div>
              <div className={styles.weekBars}>
                {monthlyStatistics.weeks.map((week) => (
                  <div key={week.label}><span>{week.label}</span><i><b style={{ height: `${Math.max(4, week.completed / maximumWeeklyActions * 100)}%` }} /></i><strong>{week.completed}</strong></div>
                ))}
              </div>
              <p>Паузы видны, но они не обнуляют предыдущие недели. Можно спокойно продолжить с сегодняшнего дня.</p>
            </article>
          </div>

          <section className={styles.habitStatistics}>
            <div className={styles.statCardHeading}><div><span className={styles.eyebrow}>КАЖДАЯ ПРИВЫЧКА</span><h2>Что получилось за месяц</h2></div><small>по выбранному тобой ритму</small></div>
            <div className={styles.habitStatList}>
              {monthlyStatistics.plants.map((item) => {
                const plant = plants.find((candidate) => candidate.id === item.plantId);
                if (!plant) return null;
                const plantSpecies = getSpecies(plant.species);
                return (
                  <article key={plant.id} className={styles.habitStatRow} style={{ "--accent": plantSpecies.accent } as CSSProperties}>
                    <span className={styles.statPlantMark}>{plantSpecies.name.slice(0, 1)}</span>
                    <div className={styles.statHabitCopy}>
                      <small>{plantSpecies.name} · {frequencyLabels[plant.frequency]} · срок {plant.goalDays}</small>
                      <strong>{plant.habit}</strong>
                      <div className={styles.habitStatBar}><i style={{ width: `${item.rate}%` }} /></div>
                      <p>{item.target === 0 ? `Выбранный срок в ${plant.goalDays} отметок завершён` : `${item.completed} выполнено · ${item.missed} без отметки · цель ${item.target}`}</p>
                    </div>
                    <div className={styles.habitStatResult}><b>{item.completed}</b><span>{item.completed === 1 ? "шаг" : "шагов"}</span><small>{item.rate}%</small></div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      ) : (
        <section className={styles.tipsSection} role="tabpanel" aria-label="Подсказки для устойчивых привычек">
          <div className={styles.tipsHero}>
            <div className={styles.tipsHeroCopy}>
              <span className={styles.eyebrow}>БЕРЕЖНЫЕ ПРИЁМЫ</span>
              <h1>Не заставлять себя.<br />Облегчать следующий шаг.</h1>
              <p>Привычка держится не только на мотивации. Ей помогают маленький вход, знакомый сигнал, удобная среда, быстрая приятность и спокойное возвращение после паузы.</p>
              <div className={styles.tipPrinciples} aria-label="Главные принципы">
                <span>меньше усилий</span><span>яснее сигнал</span><span>мягче возвращение</span>
              </div>
            </div>

            <article className={styles.sneakerLadder}>
              <div className={styles.ladderHeading}><span>СЕГОДНЯ СОВСЕМ НЕ ХОЧЕТСЯ?</span><b>Лестница одного шага</b></div>
              <ol>
                <li><span>1</span><p><b>Просто надень кроссовки</b><small>На этом уже можно остановиться.</small></p></li>
                <li><span>2</span><p><b>Подойди к двери</b><small>Никакой прогулки пока не обещаем.</small></p></li>
                <li><span>3</span><p><b>Выйди на лестницу</b><small>Постой там одну минуту.</small></p></li>
                <li><span>4</span><p><b>Выйди на улицу</b><small>Сделай десять спокойных шагов.</small></p></li>
                <li><span>5</span><p><b>Реши заново</b><small>Продолжить ещё немного или вернуться — оба решения нормальны.</small></p></li>
              </ol>
              <p className={styles.ladderPermission}><span>✓</span><b>Смысл не в том, чтобы себя обмануть.</b> Смысл — сделать начало достаточно лёгким и оставить себе настоящий выбор.</p>
            </article>
          </div>

          <div className={styles.tipsHeading}>
            <div><span className={styles.eyebrow}>МАЛЕНЬКИЕ ХИТРОСТИ</span><h2>Выбери одну, а не все сразу</h2></div>
            <p>Попробуй один приём несколько дней и посмотри, стало ли начинать легче. Если нет — это не твоя вина, просто нужен другой ключ.</p>
          </div>

          <div className={styles.tipsGrid}>
            {habitTips.map((tip) => (
              <article key={tip.id} className={styles.tipCard}>
                <div className={styles.tipCardTop}><span>{tip.marker}</span><small>{tip.category}</small></div>
                <h2>{tip.title}</h2>
                <p>{tip.description}</p>
                <blockquote><span>НАПРИМЕР</span><p>{tip.example}</p></blockquote>
                <strong><span>→</span>{tip.takeaway}</strong>
              </article>
            ))}
          </div>

          <section className={styles.personalTip}>
            <div><span className={styles.eyebrow}>ДЛЯ ТВОЕГО САДА</span><h2>Уменьши только вход в «{selected.habit}»</h2><p>Сама привычка остаётся важной. Сегодня придумай её версию на две минуты или один крошечный шаг — такую, которую можно выполнить даже без настроения.</p></div>
            <button type="button" onClick={() => { setActiveView("garden"); setMessages((current) => ({ ...current, [selected.id]: `Сегодня можно выполнить минимальную версию «${selected.habit}». Один честный маленький шаг тоже поддерживает связь с привычкой.` })); }}>Вернуться и сделать мини-шаг <span>→</span></button>
          </section>

          <aside className={styles.tipsResearch}>
            <div><span>⌁</span><p><b>Почему этим советам можно доверять</b><small>Раздел опирается на исследования формирования привычек и саморегуляции. Это не строгие правила и не гарантия результата — выбирай то, что подходит твоей жизни.</small></p></div>
            <nav aria-label="Исследования о привычках">
              <a href="https://pubmed.ncbi.nlm.nih.gov/35756236/" target="_blank" rel="noreferrer">Стабильный контекст ↗</a>
              <a href="https://pubmed.ncbi.nlm.nih.gov/26479070/" target="_blank" rel="noreferrer">Видимый прогресс ↗</a>
              <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4381662/" target="_blank" rel="noreferrer">Полезное + приятное ↗</a>
              <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3505409/" target="_blank" rel="noreferrer">Маленькие действия ↗</a>
              <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10543633/" target="_blank" rel="noreferrer">Возвращение без самокритики ↗</a>
            </nav>
          </aside>
        </section>
      )}

      <footer className={styles.footer}><span>«Рост» · мой живой сад</span><p>Каждая отметка связана с отдельным физиологическим этапом растения. Поддержка — без давления, прогресс — без наказания.</p><Link href="/">Вернуться на главную</Link></footer>

      {completionCelebration && (
        <div className={`${styles.modalBackdrop} ${styles.completionBackdrop}`} role="presentation">
          <div className={styles.completionModal} role="dialog" aria-modal="true" aria-labelledby="completion-title">
            <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ "--confetti-x": `${4 + (index * 17) % 92}%`, "--confetti-delay": `${(index % 6) * .07}s`, "--confetti-turn": `${90 + index * 37}deg` } as CSSProperties} />)}</div>
            <button className={styles.modalClose} type="button" onClick={() => setCompletionCelebration(null)} aria-label="Закрыть">×</button>
            <div className={styles.completionPlant}><span className={styles.completionHalo} aria-hidden="true" /><PlantArt plant={completionCelebration} decoration={decorationsByPlant[completionCelebration.id]} /></div>
            <span className={styles.completionKicker}>ВАУ · {completionCelebration.goalDays} ИЗ {completionCelebration.goalDays} · ТЫ СДЕЛАЛА ЭТО</span>
            <h2 id="completion-title">Ты завершила выбранный срок!</h2>
            <p>«{completionCelebration.habit}» получила {completionCelebration.goalDays} настоящих повторений. Это большое достижение — и оно уже навсегда сохранено в твоём саду.</p>
            <div className={styles.habitScienceNote}><span>КАК ЭТО РАБОТАЕТ</span><p><b>{completionCelebration.goalDays} дней — серьёзный рубеж, но ни один срок не является магической границей.</b> Автоматичность часто развивается в течение 2–5 месяцев, а точный срок сильно различается. Повторение в похожем контексте постепенно укрепляет связь между ситуацией и действием — со временем мозгу требуется меньше сознательного усилия, чтобы его начать.</p><a href="https://pubmed.ncbi.nlm.nih.gov/39685110/" target="_blank" rel="noreferrer">Кратко об исследовании ↗</a></div>
            <div className={styles.completionReward}><span>♕</span><div><small>НОВОЕ ДОСТИЖЕНИЕ</small><b>{completionCelebration.goalDays} дней подтверждены</b></div><strong>+{LIVING_COMPLETION_REWARD} ✦</strong></div>
            <div className={styles.completionActions}>{completionCelebration.goalDays < MAX_GOAL_DAYS && <button type="button" autoFocus onClick={() => extendHabit(completionCelebration.id)}>Продолжить ещё 30 дней</button>}<button type="button" autoFocus={completionCelebration.goalDays >= MAX_GOAL_DAYS} onClick={() => { setCompletionCelebration(null); setActiveView("successes"); }}>Сохранить и завершить</button></div>
            <small className={styles.completionSaved}>Сохранено в твоих достижениях · после входа синхронизируется между устройствами</small>
          </div>
        </div>
      )}

      {showPlanting && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlanting(false); }}>
          <form className={styles.modal} onSubmit={plantNewHabit}>
            <button className={styles.modalClose} type="button" onClick={() => setShowPlanting(false)} aria-label="Закрыть">×</button>
            <span className={styles.eyebrow}>НОВАЯ ПРИВЫЧКА</span><h2>Посади ещё одну цель</h2><p>Выбери растение, удобный ритм и первый срок. Растение проходит 30 видимых этапов роста, а дальнейшие повторения помогают привычке закрепляться.</p>
            <label className={styles.habitInput}><span>Моя привычка</span><input value={newHabit} onChange={(event) => setNewHabit(event.target.value)} autoFocus /></label>
            <fieldset><legend>Растение или дерево</legend><div className={styles.speciesGrid}>{species.filter((item) => unlockedSpecies.includes(item.code)).map((item) => { const preview: PlantHabit = { id: item.code, habit: item.name, species: item.code, baseCompletedDays: 29, completionDates: [], continuationDates: [], goalDays: 30, rewardedGoals: [], frequency: "daily", reminder: null, createdAt: INITIAL_UPDATED_AT, completedAt: null, updatedAt: INITIAL_UPDATED_AT }; return <button type="button" key={item.code} className={newSpecies === item.code ? styles.selectedChoice : ""} onClick={() => setNewSpecies(item.code)}><PlantArt plant={preview} /><b>{item.name}</b><small>{item.family}</small></button>; })}</div></fieldset>
            <fieldset><legend>Как часто</legend><div className={styles.choiceGrid}>{(Object.keys(frequencyLabels) as Frequency[]).map((frequency) => <button type="button" key={frequency} className={newFrequency === frequency ? styles.selectedChoice : ""} onClick={() => setNewFrequency(frequency)}>{frequencyLabels[frequency]}</button>)}</div></fieldset>
            <fieldset><legend>Первый срок</legend><div className={styles.choiceGrid}>{[30, 60, 90].map((days) => <button type="button" key={days} className={newGoalDays === days ? styles.selectedChoice : ""} onClick={() => setNewGoalDays(days)}><b>{days} дней</b><small>{days === 30 ? "первый цикл" : days === 60 ? "больше повторений" : "мягкое закрепление"}</small></button>)}</div></fieldset>
            <fieldset><legend>Напоминание</legend><div className={styles.choiceGrid}>{([null, "09:00", "18:30", "21:30"] as const).map((time) => <button type="button" key={time ?? "off"} className={newReminder === time ? styles.selectedChoice : ""} onClick={() => setNewReminder(time)}>{time ? `В ${time}` : "Не напоминать"}</button>)}</div></fieldset>
            <button className={styles.plantButtonModal} type="submit"><span>Посадить семечко</span><b>→</b></button>
          </form>
        </div>
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </main>
  );
}
