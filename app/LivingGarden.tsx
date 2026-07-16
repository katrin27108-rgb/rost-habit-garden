"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import type { PlantKind } from "../lib/domain";

export type GardenPlant = {
  id: string;
  kind: PlantKind;
  progress: number;
  health: number;
  slot: number;
  color: string;
};

type LivingGardenProps = {
  progress: number;
  todayEnergy: number;
  quietDays: number;
  burst: number;
  explore?: boolean;
  label?: string;
  plants?: GardenPlant[];
  focusPlantId?: string;
};

type Point = { x: number; y: number; seed: number; threshold: number };

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (from: number, to: number, value: number) => {
  const x = clamp((value - from) / Math.max(.001, to - from));
  return x * x * (3 - 2 * x);
};

function seededPoints(count: number, seed: number, xRadius: number, yRadius: number): Point[] {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, (_, index) => ({
    x: (random() * 2 - 1) * xRadius,
    y: (random() * 2 - 1) * yRadius + 80,
    seed: random(),
    threshold: index / count,
  }));
}

const grass = seededPoints(260, 1874, 940, 520);
const flowers = seededPoints(120, 4407, 820, 430);
const fireflies = seededPoints(34, 9031, 680, 350);
const stones = seededPoints(22, 2718, 850, 460);
const treeKinds = new Set<PlantKind>(["oak", "cherry", "birch", "willow"]);

function plantPosition(slot: number) {
  const column = slot % 10;
  const row = Math.floor(slot / 10) % 5;
  const jitter = ((slot * 47) % 61) - 30;
  return { x: (column - 4.5) * 190 + jitter, y: -15 + row * 112 + ((slot * 29) % 35) };
}

export default function LivingGarden({
  progress,
  todayEnergy,
  quietDays,
  burst,
  explore = false,
  label = "Живой сад, который растёт вместе с привычками",
  plants = [],
  focusPlantId,
}: LivingGardenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(clamp(progress));
  const shownProgressRef = useRef(clamp(progress));
  const pulseStartedRef = useRef(0);
  const previousBurstRef = useRef(burst);
  const cameraRef = useRef({ x: 0, y: 40 });
  const walkerRef = useRef({ x: -155, y: 185 });
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const keysRef = useRef(new Set<string>());
  const parallaxRef = useRef({ x: 0, y: 0 });
  const plantsRef = useRef(plants);
  const focusPlantRef = useRef(focusPlantId);

  useEffect(() => { plantsRef.current = plants; }, [plants]);
  useEffect(() => { focusPlantRef.current = focusPlantId; }, [focusPlantId]);

  useEffect(() => {
    progressRef.current = clamp(progress);
  }, [progress]);

  useEffect(() => {
    if (burst !== previousBurstRef.current) {
      previousBurstRef.current = burst;
      pulseStartedRef.current = performance.now();
    }
  }, [burst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let frame = 0;
    let previousTime = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(width < 700 ? 1.5 : 2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!explore || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(event.key)) return;
      event.preventDefault();
      keysRef.current.add(event.key.toLowerCase());
      targetRef.current = null;
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    const project = (x: number, y: number, zoom: number) => ({
      x: width / 2 + (x - cameraRef.current.x) * zoom,
      y: height * .62 + (y - cameraRef.current.y) * zoom * .54,
    });

    const drawHill = (baseY: number, color: string, amplitude: number, offset: number) => {
      context.beginPath();
      context.moveTo(0, height);
      context.lineTo(0, baseY);
      for (let x = 0; x <= width + 80; x += 80) {
        const y = baseY + Math.sin((x + offset) / 170) * amplitude + Math.sin((x + offset) / 73) * amplitude * .22;
        context.lineTo(x, y);
      }
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = color;
      context.fill();
    };

    const drawCloud = (x: number, y: number, scale: number, alpha: number) => {
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = "#fffdf0";
      context.beginPath();
      context.arc(x, y, 28 * scale, 0, Math.PI * 2);
      context.arc(x + 32 * scale, y - 12 * scale, 37 * scale, 0, Math.PI * 2);
      context.arc(x + 72 * scale, y + 2 * scale, 29 * scale, 0, Math.PI * 2);
      context.ellipse(x + 36 * scale, y + 13 * scale, 67 * scale, 24 * scale, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const drawStone = (x: number, y: number, scale: number, tone: number) => {
      context.save();
      context.translate(x, y);
      context.scale(scale, scale * .58);
      const gradient = context.createRadialGradient(-3, -5, 1, 0, 0, 14);
      gradient.addColorStop(0, `hsl(${82 + tone * 8} 14% 76%)`);
      gradient.addColorStop(1, `hsl(${82 + tone * 8} 11% 49%)`);
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(0, 0, 11, 9, -.12, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const drawGrass = (x: number, y: number, scale: number, sway: number, health: number, alpha: number) => {
      context.save();
      context.translate(x, y);
      context.globalAlpha = alpha;
      context.strokeStyle = health < .68 ? "#84945e" : "#6fa866";
      context.lineWidth = Math.max(.7, scale);
      context.lineCap = "round";
      for (let blade = -1; blade <= 1; blade += 1) {
        context.beginPath();
        context.moveTo(blade * 2.2 * scale, 0);
        context.quadraticCurveTo((blade * 3 + sway) * scale, -7 * scale, (blade * 4 + sway * 1.8) * scale, -13 * scale);
        context.stroke();
      }
      context.restore();
    };

    const drawFlower = (x: number, y: number, scale: number, hue: number, sway: number, alpha: number, health: number) => {
      context.save();
      context.translate(x, y);
      context.globalAlpha = alpha;
      context.rotate(sway * .035 + (1 - health) * .16);
      context.strokeStyle = health < .68 ? "#75875b" : "#4f9461";
      context.lineWidth = Math.max(1, scale * 1.15);
      context.beginPath();
      context.moveTo(0, 2);
      context.quadraticCurveTo(2, -9 * scale, sway * scale, -18 * scale);
      context.stroke();
      context.translate(sway * scale, -18 * scale);
      for (let petal = 0; petal < 6; petal += 1) {
        context.rotate(Math.PI / 3);
        context.fillStyle = health < .6 ? `hsl(${hue} 28% 65%)` : `hsl(${hue} 78% 72%)`;
        context.beginPath();
        context.ellipse(0, -4 * scale, 2.7 * scale, 5 * scale, 0, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = "#f7d66b";
      context.beginPath();
      context.arc(0, 0, 2.4 * scale, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const drawPond = (zoom: number, time: number) => {
      const point = project(-390, 170, zoom);
      context.save();
      context.translate(point.x, point.y);
      context.scale(zoom, zoom * .55);
      context.fillStyle = "rgba(57, 105, 92, .22)";
      context.beginPath();
      context.ellipse(0, 9, 165, 82, -.08, 0, Math.PI * 2);
      context.fill();
      const water = context.createRadialGradient(-42, -22, 12, 0, 0, 150);
      water.addColorStop(0, "#bde2d0");
      water.addColorStop(.55, "#75b8ad");
      water.addColorStop(1, "#477d78");
      context.fillStyle = water;
      context.beginPath();
      context.ellipse(0, 0, 152, 71, -.08, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(245,255,239,.55)";
      context.lineWidth = 2;
      for (let ripple = 0; ripple < 3; ripple += 1) {
        context.beginPath();
        context.ellipse(Math.sin(time * .0007 + ripple) * 36, -5 + ripple * 9, 25 + ripple * 17, 8 + ripple * 4, 0, .1, Math.PI * 1.45);
        context.stroke();
      }
      context.restore();
    };

    const drawTree = (x: number, y: number, zoom: number, growth: number, health: number, time: number) => {
      const point = project(x, y, zoom);
      const eased = Math.pow(clamp(growth), .68);
      const treeScale = zoom * (.86 + eased * .28);
      const trunkHeight = 28 + 222 * eased;
      const trunkWidth = 5 + 20 * eased;
      const sway = Math.sin(time * .00065) * (1.2 + growth * 1.8);

      context.save();
      context.translate(point.x, point.y);
      context.scale(treeScale, treeScale);

      context.fillStyle = "rgba(20, 47, 34, .18)";
      context.beginPath();
      context.ellipse(4, 6, 25 + 58 * eased, 7 + 11 * eased, 0, 0, Math.PI * 2);
      context.fill();

      const trunk = context.createLinearGradient(-trunkWidth, 0, trunkWidth, 0);
      trunk.addColorStop(0, "#5e452c");
      trunk.addColorStop(.48, "#9a7042");
      trunk.addColorStop(1, "#4a3727");
      context.fillStyle = trunk;
      context.beginPath();
      context.moveTo(-trunkWidth, 2);
      context.bezierCurveTo(-trunkWidth * .72, -trunkHeight * .38, -trunkWidth * .35 + sway, -trunkHeight * .75, sway, -trunkHeight);
      context.bezierCurveTo(trunkWidth * .35 + sway, -trunkHeight * .72, trunkWidth * .72, -trunkHeight * .35, trunkWidth, 2);
      context.closePath();
      context.fill();

      const branches = 13;
      for (let branch = 0; branch < branches; branch += 1) {
        const threshold = .08 + branch * .058;
        const reveal = smoothstep(threshold, threshold + .18, growth);
        if (reveal <= .01) continue;
        const side = branch % 2 ? 1 : -1;
        const level = .22 + branch / branches * .67;
        const originY = -trunkHeight * level;
        const length = (28 + branch * 3.2) * reveal * (1 + eased * .46);
        const endX = side * length + sway * level;
        const endY = originY - (18 + branch * 1.2) * reveal;
        context.strokeStyle = branch < 5 ? "#745134" : "#845d37";
        context.lineWidth = Math.max(1.2, (trunkWidth * (1 - level) * .52 + 1.4) * reveal);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(side * trunkWidth * .18, originY);
        context.quadraticCurveTo(side * length * .47, originY - 8 * reveal, endX, endY);
        context.stroke();

        const leafCount = 2 + Math.floor(5 * reveal + growth * 4);
        for (let leaf = 0; leaf < leafCount; leaf += 1) {
          const n = (leaf + 1) / (leafCount + 1);
          const leafX = side * length * (.55 + n * .48) + Math.sin(branch * 4.1 + leaf) * 9 * reveal;
          const leafY = originY - (9 + branch * .95) * reveal - n * 13 + Math.cos(branch + leaf * 2.7) * 7;
          const size = (3.2 + growth * 8.5) * reveal * (.78 + ((branch * 7 + leaf * 3) % 5) * .06);
          const hue = 89 + ((branch * 11 + leaf * 7) % 19);
          context.globalAlpha = .58 + health * .4;
          context.fillStyle = `hsl(${hue} ${35 + health * 34}% ${39 + health * 16}%)`;
          context.beginPath();
          context.ellipse(leafX + sway * n * .35, leafY, size * 1.28, size, (side * .25) + Math.sin(time * .001 + leaf) * .04, 0, Math.PI * 2);
          context.fill();
        }
      }

      const crownReveal = smoothstep(.38, .94, growth);
      const crownCount = Math.floor(5 + crownReveal * 34);
      for (let leaf = 0; leaf < crownCount; leaf += 1) {
        const angle = leaf * 2.399;
        const radius = Math.sqrt(leaf / Math.max(1, crownCount)) * (30 + 62 * crownReveal);
        const leafX = Math.cos(angle) * radius + sway;
        const leafY = -trunkHeight + Math.sin(angle) * radius * .48 - crownReveal * 13;
        const size = (4 + crownReveal * 12) * (.76 + (leaf % 5) * .065);
        context.globalAlpha = .46 + health * .48;
        context.fillStyle = `hsl(${88 + (leaf % 16)} ${38 + health * 32}% ${39 + health * 17}%)`;
        context.beginPath();
        context.ellipse(leafX, leafY, size * 1.35, size, angle * .16, 0, Math.PI * 2);
        context.fill();
      }

      const blossomReveal = smoothstep(.7, 1, growth) * health;
      const blossomCount = Math.floor(blossomReveal * 44);
      for (let flower = 0; flower < blossomCount; flower += 1) {
        const angle = flower * 2.14;
        const radius = 18 + Math.sqrt(flower / Math.max(1, blossomCount)) * 76;
        const bx = Math.cos(angle) * radius + sway;
        const by = -trunkHeight + Math.sin(angle) * radius * .46 - 8;
        context.globalAlpha = .74 + Math.sin(time * .0014 + flower) * .13;
        context.fillStyle = flower % 3 === 0 ? "#fff7d0" : "#f5b7a5";
        context.beginPath();
        context.arc(bx, by, 2.2 + (flower % 3) * .65, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    };

    const drawHerbPlant = (plant: GardenPlant, x: number, y: number, zoom: number, time: number) => {
      const point = project(x, y, zoom);
      const growth = clamp(plant.progress);
      const health = clamp(plant.health / 100);
      const scale = zoom * (.7 + ((plant.slot * 13) % 17) / 50);
      const height = 12 + growth * (plant.kind === "sunflower" ? 142 : 78);
      const sway = Math.sin(time * .0011 + plant.slot) * (1.2 + growth * 2.4);
      const hueByKind: Record<PlantKind, number> = { oak: 95, cherry: 345, birch: 86, willow: 102, lavender: 268, chamomile: 48, sunflower: 45, peony: 340, fern: 112, hydrangea: 215, rosemary: 125, strawberry: 355 };
      const hue = hueByKind[plant.kind];
      context.save();
      context.translate(point.x, point.y);
      context.scale(scale, scale);
      context.globalAlpha = .96;
      context.fillStyle = "rgba(34,56,35,.2)";
      context.beginPath(); context.ellipse(0, 4, 19 + growth * 15, 6 + growth * 3, 0, 0, Math.PI * 2); context.fill();
      if (growth < .055) {
        context.fillStyle = "#80603e"; context.beginPath(); context.ellipse(0, -2, 5, 3.4, -.25, 0, Math.PI * 2); context.fill();
        context.strokeStyle = "rgba(235,222,177,.65)"; context.lineWidth = 1;
        context.beginPath(); context.moveTo(0, 0); context.quadraticCurveTo(-4, 7, 2, 13); context.stroke();
        context.restore(); return;
      }
      const wilt = (1 - health) * 18;
      context.strokeStyle = health < .55 ? "#71805b" : `hsl(${108 + (plant.slot % 18)} 42% 39%)`;
      context.lineWidth = plant.kind === "rosemary" ? 2 : 3 + growth * 2;
      context.lineCap = "round";
      context.beginPath(); context.moveTo(0, 1); context.quadraticCurveTo(sway * .5, -height * .55, sway, -height + wilt); context.stroke();

      const leafPairs = Math.max(1, Math.floor(growth * (plant.kind === "rosemary" ? 11 : 6)));
      for (let index = 0; index < leafPairs; index += 1) {
        const level = (index + 1) / (leafPairs + 1);
        const ly = -height * level + wilt * level;
        const size = 4 + growth * (plant.kind === "fern" ? 13 : 7);
        for (const side of [-1, 1]) {
          context.save(); context.translate(sway * level, ly); context.rotate(side * (.55 + (1 - health) * .25));
          context.fillStyle = health < .55 ? "#84906a" : `hsl(${105 + (index % 15)} ${38 + health * 24}% ${38 + health * 12}%)`;
          context.beginPath(); context.ellipse(side * size, 0, size * 1.25, Math.max(1.8, size * .38), 0, 0, Math.PI * 2); context.fill(); context.restore();
        }
      }

      const bloom = smoothstep(.68, 1, growth) * health;
      if (plant.kind === "fern") {
        for (let frond = -3; frond <= 3; frond += 1) {
          context.strokeStyle = `hsla(${106 + frond * 3} 45% 38% / ${.45 + health * .5})`; context.lineWidth = 2.3;
          context.beginPath(); context.moveTo(0, 0); context.quadraticCurveTo(frond * 10, -height * .52, frond * 16 + sway, -height * (.72 + Math.abs(frond) * .035)); context.stroke();
        }
      } else if (bloom > .02) {
        const blossoms = plant.kind === "lavender" || plant.kind === "hydrangea" ? 9 : plant.kind === "strawberry" ? 5 : 1;
        for (let flower = 0; flower < blossoms; flower += 1) {
          const angle = flower * 2.399;
          const radius = blossoms === 1 ? 0 : 5 + Math.sqrt(flower) * 4;
          const fx = sway + Math.cos(angle) * radius;
          const fy = -height + wilt + Math.sin(angle) * radius * .55;
          const petals = plant.kind === "sunflower" ? 14 : plant.kind === "chamomile" ? 10 : 6;
          context.save(); context.translate(fx, fy); context.globalAlpha = .45 + bloom * .55;
          for (let petal = 0; petal < petals; petal += 1) {
            context.rotate(Math.PI * 2 / petals); context.fillStyle = plant.kind === "chamomile" ? "#fffdf2" : `hsl(${hue + (flower % 3) * 7} 72% ${62 + health * 15}%)`;
            context.beginPath(); context.ellipse(0, -(4 + growth * 5), 2.1 + growth * 1.5, 5 + growth * 4, 0, 0, Math.PI * 2); context.fill();
          }
          context.fillStyle = plant.kind === "sunflower" ? "#6c482a" : "#f2cf62"; context.beginPath(); context.arc(0, 0, 3 + growth * 2.5, 0, Math.PI * 2); context.fill(); context.restore();
        }
        if (plant.kind === "strawberry" && growth > .84) {
          context.fillStyle = "#d94b44"; context.beginPath(); context.ellipse(-12, -height * .32, 5, 7, 0, 0, Math.PI * 2); context.ellipse(13, -height * .46, 5, 7, 0, 0, Math.PI * 2); context.fill();
        }
      }
      context.restore();
    };

    const drawGardenPlant = (plant: GardenPlant, zoom: number, time: number) => {
      const position = plantPosition(plant.slot);
      if (treeKinds.has(plant.kind)) {
        drawTree(position.x, position.y, zoom * (plant.kind === "willow" ? .86 : .72), plant.progress, plant.health / 100, time + plant.slot * 73);
      } else {
        drawHerbPlant(plant, position.x, position.y, zoom, time);
      }
    };

    const drawWalker = (zoom: number, time: number, moving: boolean) => {
      const point = project(walkerRef.current.x, walkerRef.current.y, zoom);
      const bounce = moving ? Math.sin(time * .012) * 2.2 : Math.sin(time * .0022) * .7;
      const scale = zoom * 1.04;
      context.save();
      context.translate(point.x, point.y + bounce);
      context.scale(scale, scale);
      context.fillStyle = "rgba(24,43,32,.2)";
      context.beginPath();
      context.ellipse(0, 4, 15, 5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#e8f0c7";
      context.beginPath();
      context.roundRect(-8, -28, 16, 25, 7);
      context.fill();
      context.fillStyle = "#335b4b";
      context.fillRect(-8, -16, 16, 13);
      context.strokeStyle = "#273d35";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-4, -3);
      context.lineTo(-6 + (moving ? Math.sin(time * .012) * 3 : 0), 4);
      context.moveTo(4, -3);
      context.lineTo(6 - (moving ? Math.sin(time * .012) * 3 : 0), 4);
      context.stroke();
      context.fillStyle = "#e7b996";
      context.beginPath();
      context.arc(0, -34, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#4b382f";
      context.beginPath();
      context.arc(0, -37, 8.5, Math.PI, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const draw = (time: number) => {
      const dt = Math.min(40, time - previousTime);
      previousTime = time;
      if (document.hidden) { frame = requestAnimationFrame(draw); return; }
      shownProgressRef.current += (progressRef.current - shownProgressRef.current) * Math.min(.09, dt * .0027);
      const gardenPlants = plantsRef.current;
      const growth = gardenPlants.length ? gardenPlants.reduce((sum, plant) => sum + plant.progress, 0) / gardenPlants.length : shownProgressRef.current;
      const plantHealth = gardenPlants.length ? gardenPlants.reduce((sum, plant) => sum + plant.health, 0) / gardenPlants.length / 100 : 1;
      const rain = gardenPlants.length ? clamp((.72 - plantHealth) * 1.8) : clamp((quietDays - 1) / 5);
      const health = gardenPlants.length ? plantHealth : clamp(.72 + todayEnergy * .27 - rain * .32, .36, 1);
      const zoom = (explore ? 1 : .98) * clamp(width / 720, .58, 1.15);

      let dx = 0;
      let dy = 0;
      const keys = keysRef.current;
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;
      if (keys.has("arrowup") || keys.has("w")) dy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dy += 1;
      const movingByKeys = dx !== 0 || dy !== 0;
      if (movingByKeys) {
        const length = Math.hypot(dx, dy) || 1;
        walkerRef.current.x += (dx / length) * dt * .18;
        walkerRef.current.y += (dy / length) * dt * .18;
      } else if (explore && targetRef.current) {
        const toX = targetRef.current.x - walkerRef.current.x;
        const toY = targetRef.current.y - walkerRef.current.y;
        const distance = Math.hypot(toX, toY);
        if (distance < 7) targetRef.current = null;
        else {
          walkerRef.current.x += (toX / distance) * dt * .16;
          walkerRef.current.y += (toY / distance) * dt * .16;
        }
      }
      walkerRef.current.x = clamp(walkerRef.current.x, -920, 920);
      walkerRef.current.y = clamp(walkerRef.current.y, -430, 535);

      if (explore) {
        cameraRef.current.x += (walkerRef.current.x - cameraRef.current.x) * .035;
        cameraRef.current.y += (walkerRef.current.y - 55 - cameraRef.current.y) * .035;
      } else {
        cameraRef.current.x += (parallaxRef.current.x - cameraRef.current.x) * .018;
        cameraRef.current.y += (40 + parallaxRef.current.y - cameraRef.current.y) * .018;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, rain > .35 ? "#93aca9" : "#bde4dc");
      sky.addColorStop(.48, rain > .35 ? "#c2ccc0" : "#f8e7b6");
      sky.addColorStop(1, "#6fa268");
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);

      const sunX = width * .18 - cameraRef.current.x * .018;
      const sunY = height * .15;
      const sun = context.createRadialGradient(sunX, sunY, 4, sunX, sunY, 95 + todayEnergy * 45);
      sun.addColorStop(0, `rgba(255,248,188,${.9 - rain * .4})`);
      sun.addColorStop(.22, `rgba(255,220,119,${.56 - rain * .25})`);
      sun.addColorStop(1, "rgba(255,220,119,0)");
      context.fillStyle = sun;
      context.fillRect(0, 0, width, height * .54);

      drawCloud(width * .58 - cameraRef.current.x * .025 + Math.sin(time * .00006) * 35, height * .13, .76, .34 + rain * .43);
      drawCloud(width * .83 - cameraRef.current.x * .016 + Math.sin(time * .000045 + 2) * 28, height * .24, .48, .25 + rain * .35);
      drawHill(height * .35, rain > .4 ? "#708d79" : "#7da37c", 25, cameraRef.current.x * .07);
      drawHill(height * .43, rain > .4 ? "#81967b" : "#91b777", 33, cameraRef.current.x * .12 + 90);

      const ground = context.createLinearGradient(0, height * .38, 0, height);
      ground.addColorStop(0, rain > .4 ? "#75936e" : "#87b36e");
      ground.addColorStop(1, rain > .4 ? "#557152" : "#527f4f");
      context.fillStyle = ground;
      context.fillRect(0, height * .38, width, height * .62);

      const pathCenter = project(145, 330, zoom);
      context.save();
      context.globalAlpha = .72;
      context.fillStyle = rain > .5 ? "#a49a7d" : "#d6c793";
      context.beginPath();
      context.moveTo(pathCenter.x - 68 * zoom, height);
      context.bezierCurveTo(pathCenter.x - 126 * zoom, height * .78, pathCenter.x + 30 * zoom, height * .65, width * .57, height * .43);
      context.lineTo(width * .62, height * .43);
      context.bezierCurveTo(pathCenter.x + 100 * zoom, height * .67, pathCenter.x + 78 * zoom, height * .82, pathCenter.x + 68 * zoom, height);
      context.closePath();
      context.fill();
      context.restore();

      drawPond(zoom, time);

      for (const stone of stones) {
        const point = project(stone.x, stone.y, zoom);
        if (point.x < -30 || point.x > width + 30 || point.y < height * .35 || point.y > height + 30) continue;
        drawStone(point.x, point.y, zoom * (.5 + stone.seed * .7), stone.seed);
      }

      const grassVisibility = .14 + growth * .86;
      for (const blade of grass) {
        const reveal = smoothstep(blade.threshold - .08, blade.threshold + .18, grassVisibility);
        if (reveal <= .02) continue;
        const point = project(blade.x, blade.y, zoom);
        if (point.x < -20 || point.x > width + 20 || point.y < height * .38 || point.y > height + 25) continue;
        const sway = Math.sin(time * .0014 + blade.seed * 12) * (1.4 + blade.seed * 1.6);
        drawGrass(point.x, point.y, zoom * (.42 + blade.seed * .55), sway, health, reveal * (.28 + health * .55));
      }

      const flowerVisibility = smoothstep(.04, .92, growth);
      for (let index = 0; index < flowers.length; index += 1) {
        const flower = flowers[index];
        const reveal = smoothstep(flower.threshold - .06, flower.threshold + .13, flowerVisibility);
        if (reveal <= .02) continue;
        const point = project(flower.x, flower.y, zoom);
        if (point.x < -25 || point.x > width + 25 || point.y < height * .38 || point.y > height + 30) continue;
        const sway = Math.sin(time * .0012 + flower.seed * 10) * 1.6;
        drawFlower(point.x, point.y, zoom * (.46 + flower.seed * .54), 4 + ((index * 47) % 320), sway, reveal, health);
      }

      if (gardenPlants.length) {
        [...gardenPlants].sort((a, b) => plantPosition(a.slot).y - plantPosition(b.slot).y).forEach((plant) => drawGardenPlant(plant, zoom, time));
      } else {
        drawTree(0, 52, zoom, growth, health, time);
      }

      const isMoving = movingByKeys || Boolean(targetRef.current);
      if (explore) drawWalker(zoom, time, isMoving);

      const life = smoothstep(.36, .78, growth) * health;
      for (let index = 0; index < (reducedMotion ? 0 : fireflies.length * life); index += 1) {
        const fly = fireflies[index];
        const point = project(fly.x + Math.sin(time * .0007 + index) * 24, fly.y - 110 + Math.cos(time * .0009 + index * 2) * 32, zoom);
        const alpha = (.18 + .64 * Math.abs(Math.sin(time * .002 + index))) * life;
        context.fillStyle = `rgba(255,244,143,${alpha})`;
        context.beginPath();
        context.arc(point.x, point.y, 1.4 + fly.seed * 1.8, 0, Math.PI * 2);
        context.fill();
      }

      const pulseElapsed = time - pulseStartedRef.current;
      if (pulseElapsed >= 0 && pulseElapsed < 1800) {
        const pulse = pulseElapsed / 1800;
        const focused = gardenPlants.find((plant) => plant.id === focusPlantRef.current);
        const focusPosition = focused ? plantPosition(focused.slot) : { x: 0, y: 0 };
        const treePoint = project(focusPosition.x, focusPosition.y, zoom);
        for (let sparkle = 0; sparkle < 26; sparkle += 1) {
          const angle = sparkle * 2.399 + pulse;
          const radius = 18 + pulse * (85 + (sparkle % 7) * 11);
          const x = treePoint.x + Math.cos(angle) * radius;
          const y = treePoint.y - 80 * zoom + Math.sin(angle) * radius * .62 - pulse * 60;
          context.globalAlpha = (1 - pulse) * (.38 + (sparkle % 4) * .15);
          context.fillStyle = sparkle % 3 ? "#fff2a8" : "#dff08c";
          context.beginPath();
          context.arc(x, y, 1.5 + (sparkle % 3), 0, Math.PI * 2);
          context.fill();
        }
        context.globalAlpha = 1;
      }

      if (rain > .05) {
        context.strokeStyle = `rgba(222,239,229,${.18 + rain * .42})`;
        context.lineWidth = 1;
        const rainOffset = (time * .42) % 70;
        for (let drop = 0; drop < (reducedMotion ? 18 : 52) * rain; drop += 1) {
          const x = ((drop * 83) % (width + 80)) - 40;
          const y = ((drop * 137 + rainOffset) % (height + 80)) - 40;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x - 7, y + 18);
          context.stroke();
        }
      }

      const vignette = context.createRadialGradient(width / 2, height * .5, Math.min(width, height) * .18, width / 2, height * .52, Math.max(width, height) * .72);
      vignette.addColorStop(.45, "rgba(9,31,20,0)");
      vignette.addColorStop(1, `rgba(8,27,18,${explore ? .13 : .24})`);
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [explore, quietDays, todayEnergy]);

  const setDirection = (direction: string, pressed: boolean) => {
    if (pressed) {
      keysRef.current.add(direction);
      targetRef.current = null;
    } else {
      keysRef.current.delete(direction);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (explore) return;
    const rect = event.currentTarget.getBoundingClientRect();
    parallaxRef.current = {
      x: ((event.clientX - rect.left) / rect.width - .5) * 36,
      y: ((event.clientY - rect.top) / rect.height - .5) * 18,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!explore) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const zoom = clamp(rect.width / 720, .58, 1.15);
    targetRef.current = {
      x: cameraRef.current.x + (event.clientX - rect.left - rect.width / 2) / zoom,
      y: cameraRef.current.y + (event.clientY - rect.top - rect.height * .62) / (zoom * .54),
    };
  };

  return (
    <div className={`living-garden ${explore ? "is-exploring" : ""}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        tabIndex={explore ? 0 : -1}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => { parallaxRef.current = { x: 0, y: 0 }; }}
        onPointerDown={handlePointerDown}
      />
      <div className="live-indicator" aria-hidden="true"><i /> живой сад</div>
      {explore && <>
        <div className="walk-hint"><b>Иди куда хочется</b><span>Нажми на землю или используй стрелки / WASD</span></div>
        <div className="garden-joystick" aria-label="Управление прогулкой">
          <button aria-label="Вверх" onPointerDown={() => setDirection("arrowup", true)} onPointerUp={() => setDirection("arrowup", false)} onPointerLeave={() => setDirection("arrowup", false)}>↑</button>
          <button aria-label="Влево" onPointerDown={() => setDirection("arrowleft", true)} onPointerUp={() => setDirection("arrowleft", false)} onPointerLeave={() => setDirection("arrowleft", false)}>←</button>
          <button aria-label="Вниз" onPointerDown={() => setDirection("arrowdown", true)} onPointerUp={() => setDirection("arrowdown", false)} onPointerLeave={() => setDirection("arrowdown", false)}>↓</button>
          <button aria-label="Вправо" onPointerDown={() => setDirection("arrowright", true)} onPointerUp={() => setDirection("arrowright", false)} onPointerLeave={() => setDirection("arrowright", false)}>→</button>
        </div>
      </>}
    </div>
  );
}
