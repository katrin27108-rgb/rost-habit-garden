import type { CSSProperties, ReactNode } from "react";
import styles from "./living-garden.module.css";

export type SpeciesCode = "sunflower" | "tomato" | "lavender" | "monstera";

type PhysiologicalPlantProps = {
  species: SpeciesCode;
  progress: number;
  previousProgress: number;
  growing?: boolean;
};

type PartProps = {
  value: number;
  previous: number;
  transform?: string;
  className?: string;
  children: ReactNode;
};

const palettes = {
  sunflower: { stem: "#6f9360", leaf: "#8eae77", leafDark: "#587a54", bloom: "#efc95f", bloomDark: "#9b6a3c" },
  tomato: { stem: "#6e9160", leaf: "#88a96f", leafDark: "#52724e", bloom: "#f2d66b", bloomDark: "#d96f52" },
  lavender: { stem: "#7d9a72", leaf: "#a8b89a", leafDark: "#6c8068", bloom: "#a992c3", bloomDark: "#74628e" },
  monstera: { stem: "#688a68", leaf: "#79a27c", leafDark: "#426b57", bloom: "#b6c99d", bloomDark: "#54765f" },
} as const;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function phase(progress: number, start: number, end: number) {
  return clamp((progress - start) / (end - start));
}

function partStyle(value: number, previous: number) {
  return { "--part": value, "--part-previous": previous } as CSSProperties;
}

function Part({ value, previous, transform, className = "", children }: PartProps) {
  return (
    <g transform={transform}>
      <g className={`${styles.botanicalPart} ${className}`} style={partStyle(value, previous)}>
        {children}
      </g>
    </g>
  );
}

function GrowingPath({ d, value, previous, className = "" }: { d: string; value: number; previous: number; className?: string }) {
  return <path className={`${styles.growingPath} ${className}`} d={d} pathLength={1} style={partStyle(value, previous)} />;
}

function Leaf({ x, y, angle, value, previous, fill, vein }: { x: number; y: number; angle: number; value: number; previous: number; fill: string; vein: string }) {
  return (
    <Part value={value} previous={previous} transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d="M0 0 C15 -25 48 -27 62 -8 C46 13 18 15 0 0Z" fill={fill} />
      <path d="M3 -1 C20 -5 40 -8 55 -8" fill="none" stroke={vein} strokeLinecap="round" strokeWidth="2" opacity=".62" />
    </Part>
  );
}

function SoilAndSeed({ progress, previousProgress }: { progress: number; previousProgress: number }) {
  const seed = 1 - phase(progress, 0.04, 0.2);
  const previousSeed = 1 - phase(previousProgress, 0.04, 0.2);
  const root = phase(progress, 0, 0.14);
  const previousRoot = phase(previousProgress, 0, 0.14);

  return (
    <>
      <ellipse cx="160" cy="388" rx="83" ry="19" fill="#b59673" opacity=".2" />
      <ellipse cx="160" cy="382" rx="67" ry="13" fill="#927453" opacity=".38" />
      <GrowingPath d="M160 373 C158 386 153 395 146 404" value={root} previous={previousRoot} className={styles.rootPath} />
      <Part value={seed} previous={previousSeed} transform="translate(160 371) rotate(-17)">
        <path d="M-13 2 C-8 -11 9 -12 15 -1 C8 11 -7 12 -13 2Z" fill="#aa8050" />
        <path d="M-6 2 C0 -1 5 -3 10 -7" fill="none" stroke="#7d5f3f" strokeLinecap="round" strokeWidth="2" />
      </Part>
    </>
  );
}

function Sunflower({ progress, previousProgress }: Omit<PhysiologicalPlantProps, "species" | "growing">) {
  const color = palettes.sunflower;
  const stem = phase(progress, 0.04, 0.64);
  const previousStem = phase(previousProgress, 0.04, 0.64);
  const leaves = [
    { x: 158, y: 330, angle: 196, start: 0.1 },
    { x: 162, y: 298, angle: -18, start: 0.17 },
    { x: 158, y: 262, angle: 190, start: 0.25 },
    { x: 162, y: 224, angle: -22, start: 0.33 },
    { x: 159, y: 186, angle: 188, start: 0.41 },
    { x: 161, y: 150, angle: -28, start: 0.49 },
  ];
  const bud = phase(progress, 0.48, 0.66);
  const previousBud = phase(previousProgress, 0.48, 0.66);
  const center = phase(progress, 0.56, 0.74);
  const previousCenter = phase(previousProgress, 0.56, 0.74);

  return (
    <>
      <SoilAndSeed progress={progress} previousProgress={previousProgress} />
      <GrowingPath d="M160 374 C157 315 163 232 160 103" value={stem} previous={previousStem} className={styles.mainStem} />
      {leaves.map((leaf) => (
        <Leaf key={`${leaf.y}-${leaf.angle}`} {...leaf} value={phase(progress, leaf.start, leaf.start + 0.13)} previous={phase(previousProgress, leaf.start, leaf.start + 0.13)} fill={color.leaf} vein={color.leafDark} />
      ))}
      <Part value={bud} previous={previousBud} transform="translate(160 101)">
        <path d="M-18 6 C-13 -22 13 -22 18 6 C12 19 -11 20 -18 6Z" fill={color.leafDark} />
      </Part>
      <g transform="translate(160 96)">
        {Array.from({ length: 18 }, (_, index) => {
          const start = 0.59 + index * 0.012;
          return (
            <g key={index} transform={`rotate(${index * 20})`}>
              <Part value={phase(progress, start, start + 0.2)} previous={phase(previousProgress, start, start + 0.2)}>
                <ellipse cx="0" cy="-27" rx="8.5" ry="25" fill={index % 2 ? "#f2cd67" : color.bloom} />
              </Part>
            </g>
          );
        })}
        <Part value={center} previous={previousCenter}>
          <circle r="31" fill={color.bloomDark} />
          <circle r="22" fill="#765039" opacity=".72" />
          {Array.from({ length: 12 }, (_, index) => <circle key={index} cx={Math.cos(index * Math.PI / 6) * 15} cy={Math.sin(index * Math.PI / 6) * 15} r="2.2" fill="#d9aa4f" opacity=".75" />)}
        </Part>
      </g>
    </>
  );
}

function Tomato({ progress, previousProgress }: Omit<PhysiologicalPlantProps, "species" | "growing">) {
  const color = palettes.tomato;
  const stem = phase(progress, 0.03, 0.62);
  const previousStem = phase(previousProgress, 0.03, 0.62);
  const leaves = [
    { x: 160, y: 330, angle: 198, start: 0.1 }, { x: 162, y: 300, angle: -20, start: 0.16 },
    { x: 158, y: 268, angle: 192, start: 0.23 }, { x: 161, y: 235, angle: -24, start: 0.3 },
    { x: 158, y: 202, angle: 190, start: 0.37 }, { x: 161, y: 168, angle: -26, start: 0.44 },
  ];
  const branches = [
    { d: "M160 265 C194 248 216 225 230 202", start: 0.28 },
    { d: "M160 224 C128 208 108 185 95 164", start: 0.36 },
    { d: "M160 187 C188 169 204 148 215 128", start: 0.44 },
  ];
  const fruit = [
    { x: 229, y: 205, start: 0.64 }, { x: 210, y: 221, start: 0.7 },
    { x: 96, y: 168, start: 0.73 }, { x: 113, y: 184, start: 0.79 },
    { x: 216, y: 130, start: 0.82 },
  ];

  return (
    <>
      <SoilAndSeed progress={progress} previousProgress={previousProgress} />
      <GrowingPath d="M160 374 C158 310 164 225 160 110" value={stem} previous={previousStem} className={styles.mainStem} />
      {branches.map((branch) => <GrowingPath key={branch.d} d={branch.d} value={phase(progress, branch.start, branch.start + 0.22)} previous={phase(previousProgress, branch.start, branch.start + 0.22)} className={styles.branchStem} />)}
      {leaves.map((leaf) => <Leaf key={`${leaf.y}-${leaf.angle}`} {...leaf} value={phase(progress, leaf.start, leaf.start + 0.14)} previous={phase(previousProgress, leaf.start, leaf.start + 0.14)} fill={color.leaf} vein={color.leafDark} />)}
      {fruit.map((item, index) => {
        const blossom = phase(progress, item.start - 0.2, item.start);
        const previousBlossom = phase(previousProgress, item.start - 0.2, item.start);
        const tomato = phase(progress, item.start, Math.min(1, item.start + 0.18));
        const previousTomato = phase(previousProgress, item.start, Math.min(1, item.start + 0.18));
        return (
          <g key={`${item.x}-${item.y}`} transform={`translate(${item.x} ${item.y})`}>
            <Part value={blossom * (1 - tomato)} previous={previousBlossom * (1 - previousTomato)}>
              {Array.from({ length: 5 }, (_, petal) => <ellipse key={petal} transform={`rotate(${petal * 72})`} cy="-8" rx="4" ry="9" fill={color.bloom} />)}
            </Part>
            <Part value={tomato} previous={previousTomato}>
              <circle cy="7" r={index % 2 ? 14 : 17} fill={color.bloomDark} />
              <path d="M-8 -3 L0 3 L8 -3 L5 7 L-5 7Z" fill={color.leafDark} />
            </Part>
          </g>
        );
      })}
    </>
  );
}

function Lavender({ progress, previousProgress }: Omit<PhysiologicalPlantProps, "species" | "growing">) {
  const color = palettes.lavender;
  const stems = [-78, -54, -30, 0, 30, 54, 78];

  return (
    <>
      <SoilAndSeed progress={progress} previousProgress={previousProgress} />
      {stems.map((offset, index) => {
        const start = 0.05 + index * 0.035;
        const topY = 116 + Math.abs(offset) * 0.55;
        const x = 160 + offset;
        const stem = phase(progress, start, start + 0.5);
        const previousStem = phase(previousProgress, start, start + 0.5);
        const spike = phase(progress, 0.42 + index * 0.045, 0.76 + index * 0.03);
        const previousSpike = phase(previousProgress, 0.42 + index * 0.045, 0.76 + index * 0.03);
        return (
          <g key={offset}>
            <GrowingPath d={`M160 375 C${154 + offset * 0.35} 310 ${x} 220 ${x} ${topY}`} value={stem} previous={previousStem} className={styles.lavenderStem} />
            {[0, 1, 2].map((leafIndex) => {
              const leafStart = start + 0.12 + leafIndex * 0.09;
              return <Leaf key={leafIndex} x={160 + offset * (0.25 + leafIndex * 0.22)} y={318 - leafIndex * 54} angle={index % 2 ? -22 : 202} value={phase(progress, leafStart, leafStart + 0.14)} previous={phase(previousProgress, leafStart, leafStart + 0.14)} fill={color.leaf} vein={color.leafDark} />;
            })}
            <g transform={`translate(${x} ${topY})`}>
              {Array.from({ length: 7 }, (_, budIndex) => (
                <Part key={budIndex} value={phase(spike, budIndex * 0.09, budIndex * 0.09 + 0.4)} previous={phase(previousSpike, budIndex * 0.09, budIndex * 0.09 + 0.4)} transform={`translate(${budIndex % 2 ? 6 : -6} ${-budIndex * 10})`}>
                  <ellipse rx="6" ry="11" fill={budIndex % 2 ? color.bloom : color.bloomDark} />
                </Part>
              ))}
            </g>
          </g>
        );
      })}
    </>
  );
}

function Monstera({ progress, previousProgress }: Omit<PhysiologicalPlantProps, "species" | "growing">) {
  const color = palettes.monstera;
  const leaves = [
    { x: 160, y: 322, angle: 205, start: 0.08, size: 0.72 },
    { x: 160, y: 304, angle: -24, start: 0.18, size: 0.84 },
    { x: 158, y: 272, angle: 192, start: 0.3, size: 0.94 },
    { x: 162, y: 240, angle: -22, start: 0.42, size: 1.04 },
    { x: 159, y: 202, angle: 190, start: 0.54, size: 1.14 },
    { x: 162, y: 164, angle: -26, start: 0.66, size: 1.22 },
    { x: 160, y: 125, angle: 176, start: 0.8, size: 1.28 },
  ];

  return (
    <>
      <SoilAndSeed progress={progress} previousProgress={previousProgress} />
      {leaves.map((leaf, index) => {
        const stem = phase(progress, leaf.start - 0.08, leaf.start + 0.12);
        const previousStem = phase(previousProgress, leaf.start - 0.08, leaf.start + 0.12);
        const value = phase(progress, leaf.start, Math.min(1, leaf.start + 0.22));
        const previous = phase(previousProgress, leaf.start, Math.min(1, leaf.start + 0.22));
        const endX = leaf.angle > 90 ? 92 - index * 2 : 228 + index * 2;
        return (
          <g key={leaf.start}>
            <GrowingPath d={`M160 374 C${160 + (endX - 160) * 0.18} 310 ${endX} ${leaf.y + 45} ${endX} ${leaf.y}`} value={stem} previous={previousStem} className={styles.monsteraStem} />
            <Part value={value} previous={previous} transform={`translate(${endX} ${leaf.y}) rotate(${leaf.angle}) scale(${leaf.size})`}>
              <path d="M0 0 C12 -39 58 -50 76 -18 C84 10 48 37 0 0Z" fill={index % 2 ? color.leaf : color.leafDark} />
              <path d="M4 -1 C28 -8 52 -14 69 -19" fill="none" stroke="#d7dfbf" strokeLinecap="round" strokeWidth="2" opacity=".58" />
              <path d="M29 -8 L21 -25 M43 -12 L40 -32 M55 -16 L59 -31" stroke="#d7dfbf" strokeLinecap="round" strokeWidth="3" opacity={phase(progress, 0.48, 0.9)} />
            </Part>
          </g>
        );
      })}
    </>
  );
}

export function plantGrowthLabel(species: SpeciesCode, progress: number) {
  if (progress <= 0.01) return "Семечко в земле";
  if (progress < 0.12) return "Семечко проклёвывается";
  if (progress < 0.48) return "Стебель растёт, листья разворачиваются";
  if (species === "monstera") return progress < 0.82 ? "Разворачиваются новые листья" : "Листья становятся крупнее и резнее";
  if (species === "tomato") return progress < 0.68 ? "Появляются цветки" : "Цветки превращаются в плоды";
  if (species === "lavender") return progress < 0.7 ? "Формируются цветочные колоски" : "Бутоны раскрываются снизу вверх";
  return progress < 0.68 ? "Формируется бутон" : "Лепестки раскрываются один за другим";
}

export function nextPlantChange(species: SpeciesCode, progress: number) {
  if (progress < 0.08) return "семечко раскроется и покажется росток";
  if (progress < 0.48) return "стебель подрастёт и развернётся ещё один лист";
  if (species === "monstera") return "новый лист поднимется и начнёт разворачиваться";
  if (species === "tomato") return progress < 0.68 ? "раскроется ещё один цветок" : "один из плодов станет заметнее";
  if (species === "lavender") return "ещё несколько бутонов раскроются на колоске";
  return progress < 0.68 ? "бутон станет больше" : "ещё несколько лепестков раскроются";
}

export default function PhysiologicalPlant({ species, progress, previousProgress, growing = false }: PhysiologicalPlantProps) {
  const safeProgress = clamp(progress);
  const safePrevious = clamp(previousProgress);
  const palette = palettes[species];

  return (
    <svg
      className={`${styles.botanicalSvg} ${growing ? styles.plantGrowing : ""}`}
      style={{ "--stem": palette.stem } as CSSProperties}
      viewBox="0 0 320 420"
      role="img"
      aria-label={`${plantGrowthLabel(species, safeProgress)}. Рост ${Math.round(safeProgress * 100)} процентов.`}
      preserveAspectRatio="xMidYMax meet"
    >
      {species === "sunflower" && <Sunflower progress={safeProgress} previousProgress={safePrevious} />}
      {species === "tomato" && <Tomato progress={safeProgress} previousProgress={safePrevious} />}
      {species === "lavender" && <Lavender progress={safeProgress} previousProgress={safePrevious} />}
      {species === "monstera" && <Monstera progress={safeProgress} previousProgress={safePrevious} />}
    </svg>
  );
}
