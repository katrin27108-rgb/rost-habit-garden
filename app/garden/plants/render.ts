import type { PrototypePlant, PrototypeQuality } from "../types";
import type { GardenResources } from "../resources";
import { SPECIES_DESIGNS, growthParts, smoothstep } from "./species";

type RenderPlantOptions = {
  context: CanvasRenderingContext2D;
  plant: PrototypePlant;
  screenX: number;
  screenY: number;
  zoom: number;
  time: number;
  quality: PrototypeQuality;
  reducedMotion: boolean;
  textures: GardenResources;
};

const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const color = (healthy: string, dry: string, health: number, alpha = 1) => {
  const ah = healthy.match(/\w\w/g)?.map((v) => parseInt(v, 16)) ?? [70, 110, 70];
  const ad = dry.match(/\w\w/g)?.map((v) => parseInt(v, 16)) ?? [116, 105, 72];
  return `rgba(${mix(ad[0], ah[0], health)},${mix(ad[1], ah[1], health)},${mix(ad[2], ah[2], health)},${alpha})`;
};

export function drawPrototypePlant(options: RenderPlantOptions) {
  const { context, plant, screenX, screenY, zoom, time, quality, reducedMotion, textures } = options;
  // Hot reload can briefly retain an older animation frame while resources are
  // being replaced. The normal render path always supplies textures, but this
  // guard keeps that transient frame from breaking the whole preview.
  if (!textures) return;
  context.save();
  context.translate(screenX, screenY);
  context.scale(zoom, zoom);
  drawContactShadow(context, plant);
  drawSeedAndRoots(context, plant);
  if (plant.progress > .08) {
    if (plant.species === "oak") drawOak(context, plant, time, quality, reducedMotion, textures.oakCanopy);
    else if (plant.species === "willow") drawWillow(context, plant, time, quality, reducedMotion, textures.willowCanopy);
    else drawLavender(context, plant, time, quality, reducedMotion, textures.lavenderBush);
  }
  context.restore();
}

function drawContactShadow(context: CanvasRenderingContext2D, plant: PrototypePlant) {
  const design = SPECIES_DESIGNS[plant.species];
  const grown = smoothstep(.08, 1, plant.progress);
  const shadow = context.createRadialGradient(0, 3, 2, 0, 3, design.matureWidth * .34 * grown + 8);
  shadow.addColorStop(0, `rgba(18,35,20,${.18 + plant.health * .16})`);
  shadow.addColorStop(1, "rgba(18,35,20,0)");
  context.fillStyle = shadow;
  context.beginPath();
  context.ellipse(0, 4, 10 + design.matureWidth * .34 * grown, 5 + design.matureWidth * .075 * grown, 0, 0, Math.PI * 2);
  context.fill();
}

function drawSeedAndRoots(context: CanvasRenderingContext2D, plant: PrototypePlant) {
  const parts = growthParts(plant.progress);
  if (parts.root <= .01 || plant.progress > .22) return;
  context.save();
  context.globalAlpha = 1 - smoothstep(.14, .23, plant.progress);
  const soil = context.createRadialGradient(-2, 2, 2, 0, 4, 19);
  soil.addColorStop(0, "rgba(117,83,48,.9)");
  soil.addColorStop(1, "rgba(72,54,35,0)");
  context.fillStyle = soil;
  context.beginPath();
  context.ellipse(0, 3, 24, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = `rgba(225,213,169,${.42 + parts.root * .46})`;
  context.lineWidth = 1.25;
  for (let root = 0; root < 5; root += 1) {
    const side = root % 2 ? 1 : -1;
    context.beginPath();
    context.moveTo(0, 2);
    context.bezierCurveTo(side * (3 + root * 2) * parts.root, 7, side * (7 + root * 4) * parts.root, 11 + root * 2, side * (10 + root * 5) * parts.root, 17 + root * 3);
    context.stroke();
  }
  context.fillStyle = plant.species === "lavender" ? "#73533d" : "#765538";
  context.beginPath();
  context.ellipse(0, -1, 6, 3.8, -.28, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function windFor(plant: PrototypePlant, time: number, factor: number, reducedMotion: boolean) {
  if (reducedMotion) return (1 - plant.health) * factor * .4;
  const speed = .00028 + plant.health * .00048;
  return Math.sin(time * speed + plant.x * .01) * factor * (.24 + plant.health * .76);
}

function drawOak(context: CanvasRenderingContext2D, plant: PrototypePlant, time: number, quality: PrototypeQuality, reducedMotion: boolean, canopyTexture: HTMLImageElement) {
  const design = SPECIES_DESIGNS.oak;
  const parts = growthParts(plant.progress);
  const youth = smoothstep(.08, .42, plant.progress);
  const height = 18 + design.matureHeight * (.12 * parts.shoot + .88 * parts.trunk);
  const width = 4 + 25 * parts.trunk;
  const droop = (1 - plant.health) * 28;
  const wind = windFor(plant, time, 5.5, reducedMotion);

  const trunk = context.createLinearGradient(-width, 0, width, 0);
  trunk.addColorStop(0, color(design.trunk, "#6c604a", plant.health));
  trunk.addColorStop(.44, color(design.trunkLight, "#92836a", plant.health));
  trunk.addColorStop(.72, color("#64462d", "#716651", plant.health));
  trunk.addColorStop(1, color("#38291f", "#574f43", plant.health));
  context.fillStyle = trunk;
  context.beginPath();
  context.moveTo(-width, 2);
  context.bezierCurveTo(-width * .78, -height * .36, -width * .42 + wind * .12, -height * .76, wind, -height);
  context.bezierCurveTo(width * .35 + wind, -height * .76, width * .8, -height * .35, width, 2);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(48,32,22,.34)";
  context.lineWidth = 1.1 + parts.trunk * 1.4;
  for (let ridge = -2; ridge <= 2; ridge += 1) {
    context.beginPath();
    context.moveTo(ridge * width * .24, -4);
    context.bezierCurveTo(ridge * width * .18 + 2, -height * .35, ridge * width * .2 - 3, -height * .7, wind + ridge * 2, -height * .96);
    context.stroke();
  }

  const branchCount = quality === "full" ? 17 : 11;
  for (let index = 0; index < branchCount; index += 1) {
    const threshold = .29 + index / branchCount * .38;
    const reveal = smoothstep(threshold, threshold + .17, plant.progress);
    if (reveal < .01) continue;
    const side = index % 2 ? 1 : -1;
    const level = .23 + (index / branchCount) * .68;
    const originY = -height * level;
    const length = (32 + index * 4.2) * reveal * (.7 + youth * .46);
    const endX = side * length + wind * level;
    const endY = originY - (14 + index * 1.7) * reveal + droop * level;
    context.strokeStyle = color("#644329", "#746650", plant.health, .94);
    context.lineWidth = Math.max(1.2, width * (1 - level) * .56 * reveal + 1.1);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(side * width * .12, originY);
    context.bezierCurveTo(side * length * .32, originY - 8 * reveal, side * length * .7, endY + 8, endX, endY);
    context.stroke();
    drawOakLeafCluster(context, endX, endY, index, reveal * parts.leaves, plant.health, wind, droop, quality);
  }

  drawOakCanopyMass(context, height, parts.leaves, plant.health, wind, droop, quality);

  const crownReveal = parts.leaves;
  const clusters = quality === "full" ? 25 : 15;
  for (let index = 0; index < clusters; index += 1) {
    const reveal = smoothstep(index / clusters * .72, index / clusters * .72 + .25, crownReveal);
    if (reveal <= .01) continue;
    const angle = index * 2.399;
    const radius = Math.sqrt(index / clusters) * (38 + parts.branches * 82);
    drawOakLeafCluster(
      context,
      Math.cos(angle) * radius + wind,
      -height + Math.sin(angle) * radius * .48 - parts.leaves * 18 + droop * .35,
      index + 31,
      reveal,
      plant.health,
      wind,
      droop,
      quality,
    );
  }

  drawCanopyTexture(context, canopyTexture, 0, -height - 15, 286, 214, parts.leaves, plant.health, wind * .18, droop * .28, "oak");

  drawBuds(context, 0, -height - 14 + droop * .25, design.blossom, parts.buds, parts.bloom, plant.health, quality === "full" ? 18 : 9, 92, .52);
}

function drawOakCanopyMass(
  context: CanvasRenderingContext2D,
  height: number,
  reveal: number,
  health: number,
  wind: number,
  droop: number,
  quality: PrototypeQuality,
) {
  const clusterCount = quality === "full" ? 19 : 11;
  for (let index = 0; index < clusterCount; index += 1) {
    const localReveal = smoothstep(index / clusterCount * .68, index / clusterCount * .68 + .3, reveal);
    if (localReveal <= .015) continue;
    const angle = index * 2.399;
    const ring = Math.sqrt((index + 1) / clusterCount);
    const cx = Math.cos(angle) * ring * 92 + wind * (.35 + ring * .3);
    const cy = -height - 8 + Math.sin(angle) * ring * 47 + droop * (.12 + ring * .14);
    const radiusX = (25 + (index % 4) * 5) * (.48 + localReveal * .52);
    const radiusY = (18 + (index % 3) * 4) * (.5 + localReveal * .5);
    const gradient = context.createRadialGradient(cx - radiusX * .3, cy - radiusY * .35, 2, cx, cy, radiusX);
    gradient.addColorStop(0, color("#8da85a", "#a09670", health, .28 * localReveal));
    gradient.addColorStop(.55, color(index % 2 ? "#4f793e" : "#3c6939", "#7b795e", health, .34 * localReveal));
    gradient.addColorStop(1, color("#254f32", "#626553", health, .18 * localReveal));
    context.fillStyle = gradient;
    organicCrownShape(context, cx, cy, radiusX, radiusY, index);
    context.fill();
    context.strokeStyle = color("#315c35", "#77705a", health, .2 * localReveal);
    context.lineWidth = .8;
    context.stroke();
  }
}

function organicCrownShape(context: CanvasRenderingContext2D, cx: number, cy: number, radiusX: number, radiusY: number, seed: number) {
  const points = 10;
  context.beginPath();
  for (let point = 0; point <= points; point += 1) {
    const index = point % points;
    const angle = index / points * Math.PI * 2;
    const wobble = .78 + ((index * 17 + seed * 11) % 9) / 28;
    const x = cx + Math.cos(angle) * radiusX * wobble;
    const y = cy + Math.sin(angle) * radiusY * wobble;
    if (point === 0) context.moveTo(x, y);
    else {
      const previousAngle = (index - .5) / points * Math.PI * 2;
      context.quadraticCurveTo(
        cx + Math.cos(previousAngle) * radiusX * 1.06,
        cy + Math.sin(previousAngle) * radiusY * 1.06,
        x,
        y,
      );
    }
  }
  context.closePath();
}

function drawOakLeafCluster(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
  reveal: number,
  health: number,
  wind: number,
  droop: number,
  quality: PrototypeQuality,
) {
  const leaves = quality === "full" ? 7 : 4;
  for (let leaf = 0; leaf < leaves; leaf += 1) {
    const angle = seed * 1.91 + leaf * 2.17;
    const radius = (5 + leaf * 2.5) * reveal;
    const lx = x + Math.cos(angle) * radius + wind * .16;
    const ly = y + Math.sin(angle) * radius * .62 + droop * .08;
    const size = (5 + (leaf % 3) * 1.8) * (.35 + reveal * .65);
    context.fillStyle = leaf % 3 === 0
      ? color("#799850", "#9a8e67", health, .82)
      : color("#38673b", "#77745a", health, .88);
    context.beginPath();
    context.ellipse(lx, ly, size * 1.28, size, angle * .19 + (1 - health) * .18, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = `rgba(30,65,34,${.15 + health * .17})`;
    context.lineWidth = .55;
    context.beginPath();
    context.moveTo(lx - Math.cos(angle) * size * .6, ly);
    context.lineTo(lx + Math.cos(angle) * size * .65, ly);
    context.stroke();
  }
}

function drawWillow(context: CanvasRenderingContext2D, plant: PrototypePlant, time: number, quality: PrototypeQuality, reducedMotion: boolean, canopyTexture: HTMLImageElement) {
  const design = SPECIES_DESIGNS.willow;
  const parts = growthParts(plant.progress);
  const height = 20 + design.matureHeight * (.14 * parts.shoot + .86 * parts.trunk);
  const width = 4 + 17 * parts.trunk;
  const droop = 18 + parts.branches * 76 + (1 - plant.health) * 35;
  const wind = windFor(plant, time, 10, reducedMotion);

  const trunk = context.createLinearGradient(-width, 0, width, 0);
  trunk.addColorStop(0, color(design.trunk, "#756c59", plant.health));
  trunk.addColorStop(.48, color(design.trunkLight, "#a19678", plant.health));
  trunk.addColorStop(1, color("#463726", "#665e4f", plant.health));
  context.fillStyle = trunk;
  context.beginPath();
  context.moveTo(-width, 2);
  context.bezierCurveTo(-width * .78, -height * .37, width * .1 - 12, -height * .73, wind - 4, -height);
  context.bezierCurveTo(width * .28 + wind, -height * .75, width * .72, -height * .36, width, 2);
  context.closePath();
  context.fill();

  const limbs = quality === "full" ? 15 : 10;
  for (let index = 0; index < limbs; index += 1) {
    const threshold = .3 + index / limbs * .34;
    const reveal = smoothstep(threshold, threshold + .2, plant.progress);
    if (reveal < .01) continue;
    const side = index % 2 ? 1 : -1;
    const level = .4 + (index / limbs) * .54;
    const oy = -height * level;
    const reach = (42 + index * 4.5) * reveal;
    const ex = side * reach + wind * level;
    const ey = oy - 20 * reveal;
    context.strokeStyle = color("#695239", "#81755f", plant.health, .92);
    context.lineWidth = Math.max(1.2, (5.2 - index * .22) * reveal);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(side * width * .12, oy);
    context.quadraticCurveTo(side * reach * .45, oy - 24, ex, ey);
    context.stroke();

    const curtains = quality === "full" ? 4 : 3;
    for (let strand = 0; strand < curtains; strand += 1) {
      const strandReveal = smoothstep(.5 + strand * .055, .78 + strand * .04, plant.progress) * reveal;
      if (strandReveal <= .01) continue;
      const sx = ex - side * strand * 10;
      const length = droop * (.55 + strand * .12) * strandReveal;
      const wave = wind * (.4 + strand * .1);
      context.strokeStyle = color("#557244", "#777861", plant.health, .62 + strand * .06);
      context.lineWidth = 1.15 + strandReveal;
      context.beginPath();
      context.moveTo(sx, ey);
      context.bezierCurveTo(sx + wave, ey + length * .3, sx - wave * .35, ey + length * .7, sx + wave * .55, ey + length);
      context.stroke();
      const leafCount = quality === "full" ? 8 : 5;
      for (let leaf = 0; leaf < leafCount; leaf += 1) {
        const n = (leaf + 1) / (leafCount + 1);
        const alpha = smoothstep(leaf / leafCount * .72, leaf / leafCount * .72 + .24, parts.leaves) * strandReveal;
        if (alpha < .02) continue;
        const lx = sx + Math.sin(n * Math.PI * 2 + strand) * wave * .35;
        const ly = ey + length * n;
        context.fillStyle = leaf % 2
          ? color(design.leafLight, "#9c9875", plant.health, alpha * .9)
          : color(design.leaf, "#77765d", plant.health, alpha * .9);
        context.beginPath();
        context.ellipse(lx + (leaf % 2 ? 4 : -4), ly, 6.5, 1.8, leaf % 2 ? .35 : -.35, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  drawWillowCurtain(context, height, parts.leaves, plant.health, wind, droop, quality);
  drawCanopyTexture(context, canopyTexture, wind * .22, -height + 26, 288, 226, parts.leaves, plant.health, wind * .14, droop * .18, "willow");
}

function drawWillowCurtain(
  context: CanvasRenderingContext2D,
  height: number,
  reveal: number,
  health: number,
  wind: number,
  droop: number,
  quality: PrototypeQuality,
) {
  if (reveal <= .01) return;
  const tufts = quality === "full" ? 12 : 7;
  for (let index = 0; index < tufts; index += 1) {
    const angle = index * 2.399;
    const ring = Math.sqrt((index + 1) / tufts);
    const cx = Math.cos(angle) * ring * 82 + wind * .45;
    const cy = -height + Math.sin(angle) * ring * 35 + 5;
    const localReveal = smoothstep(index / tufts * .62, index / tufts * .62 + .34, reveal);
    if (localReveal < .01) continue;
    context.fillStyle = color(index % 2 ? "#64824b" : "#4d7143", "#84816a", health, .5 * localReveal);
    organicCrownShape(context, cx, cy, 27 + (index % 3) * 5, 15 + (index % 2) * 4, index + 60);
    context.fill();
  }

  const strands = quality === "full" ? 28 : 16;
  for (let strand = 0; strand < strands; strand += 1) {
    const n = strand / Math.max(1, strands - 1);
    const startX = -104 + n * 208;
    const arch = Math.pow(Math.abs(n - .5) * 2, 1.35);
    const startY = -height + 15 + arch * 45 + (strand % 3) * 5;
    const strandReveal = smoothstep(n * .42, n * .42 + .34, reveal);
    if (strandReveal < .015) continue;
    const length = (82 + (strand % 7) * 13 + droop * .42) * strandReveal;
    const wave = wind * (.35 + (strand % 5) * .09);
    context.strokeStyle = color("#4f7342", "#7e7d68", health, .48 + strandReveal * .28);
    context.lineWidth = .8 + strandReveal * 1.1;
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(startX + wave, startY + length * .3, startX - wave * .28, startY + length * .72, startX + wave * .5, startY + length);
    context.stroke();
    const leaves = quality === "full" ? 11 : 7;
    for (let leaf = 0; leaf < leaves; leaf += 1) {
      const ln = (leaf + 1) / (leaves + 1);
      const lx = startX + Math.sin(ln * Math.PI * 2 + strand) * wave * .22;
      const ly = startY + length * ln;
      const side = leaf % 2 ? 1 : -1;
      context.fillStyle = color(side > 0 ? "#91a95b" : "#4c7545", "#8f8b70", health, .62 + strandReveal * .3);
      context.beginPath();
      context.ellipse(lx + side * 4.5, ly, 6.7, 1.65, side * .42, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawLavender(context: CanvasRenderingContext2D, plant: PrototypePlant, time: number, quality: PrototypeQuality, reducedMotion: boolean, bushTexture: HTMLImageElement) {
  const design = SPECIES_DESIGNS.lavender;
  const parts = growthParts(plant.progress);
  const stems = quality === "full" ? 25 : 14;
  const healthDroop = (1 - plant.health) * 18;
  const wind = windFor(plant, time, 5.5, reducedMotion);

  for (let index = 0; index < stems; index += 1) {
    const reveal = smoothstep(.1 + index / stems * .4, .27 + index / stems * .53, plant.progress);
    if (reveal <= .01) continue;
    const angle = -1.2 + (index / Math.max(1, stems - 1)) * 2.4;
    const height = (26 + (index % 7) * 7 + design.matureHeight * .48) * reveal;
    const spread = Math.sin(angle) * (22 + parts.branches * 48);
    const tipX = spread + wind * (.3 + Math.abs(angle) * .25);
    const tipY = -height + healthDroop * (Math.abs(angle) + .35);
    context.strokeStyle = color(index % 3 ? design.trunk : design.trunkLight, "#7b7865", plant.health, .7 + reveal * .25);
    context.lineWidth = 1.2 + reveal * 1.2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, 1);
    context.quadraticCurveTo(spread * .45, -height * .52, tipX, tipY);
    context.stroke();

    const leafPairs = quality === "full" ? 5 : 3;
    for (let leaf = 0; leaf < leafPairs; leaf += 1) {
      const n = (leaf + 1) / (leafPairs + 1);
      const lx = spread * n * .62;
      const ly = -height * n * .72;
      const leafReveal = smoothstep(.33 + leaf * .055, .57 + leaf * .06, plant.progress) * reveal;
      context.fillStyle = color(design.leafLight, "#8e8b78", plant.health, leafReveal * .88);
      for (const side of [-1, 1]) {
        context.beginPath();
        context.ellipse(lx + side * 5.5, ly + healthDroop * n * .35, 7.5, 1.65, side * .34 + angle * .12, 0, Math.PI * 2);
        context.fill();
      }
    }

    const flowerReveal = parts.buds * reveal;
    if (flowerReveal <= .01) continue;
    const florets = quality === "full" ? 9 : 6;
    for (let floret = 0; floret < florets; floret += 1) {
      const n = floret / florets;
      const bloom = smoothstep(n * .72, n * .72 + .28, parts.bloom + .12);
      const fy = tipY - n * (18 + 10 * flowerReveal);
      const fx = tipX + Math.sin(floret * 2.3 + index) * 3.2;
      context.fillStyle = floret % 3 === 0
        ? color("#ab91d0", "#8f867c", plant.health, (.32 + bloom * .68) * flowerReveal)
        : color(design.blossom, "#817775", plant.health, (.34 + bloom * .66) * flowerReveal);
      context.beginPath();
      context.ellipse(fx, fy, 3.2 + bloom * 1.3, 2.4 + bloom * 1.7, -.3, 0, Math.PI * 2);
      context.fill();
    }
  }

  if (plant.health > .8 && parts.bloom > .65) {
    context.fillStyle = `rgba(235,226,249,${(parts.bloom - .65) * .7})`;
    context.beginPath();
    context.arc(-42 + wind, -74, 1.5, 0, Math.PI * 2);
    context.arc(38 - wind, -88, 1.2, 0, Math.PI * 2);
    context.fill();
  }
  const textureReveal = Math.max(parts.leaves * .72, parts.bloom);
  drawCanopyTexture(context, bushTexture, wind * .2, -54 + healthDroop * .3, 218, 154, textureReveal, plant.health, wind * .08, healthDroop * .22, "lavender");
}

function drawCanopyTexture(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  reveal: number,
  health: number,
  sway: number,
  droop: number,
  kind: "oak" | "willow" | "lavender",
) {
  const visible = smoothstep(.05, .94, reveal);
  if (visible <= .01) return;
  const sourceVisible = kind === "willow" ? .34 + visible * .66 : .42 + visible * .58;
  const sourceHeight = image.height * sourceVisible;
  const sourceY = kind === "willow" ? 0 : image.height - sourceHeight;
  const destinationHeight = height * sourceVisible;
  const destinationY = kind === "willow" ? centerY - height * .3 : centerY + height * .5 - destinationHeight;
  context.save();
  context.globalAlpha = (.12 + visible * .92) * (.62 + health * .38);
  context.filter = `saturate(${.45 + health * .65}) brightness(${.74 + health * .3}) sepia(${(1 - health) * .2})`;
  context.translate(centerX + sway, destinationY + droop);
  context.rotate((1 - health) * (kind === "lavender" ? .035 : .018));
  context.transform(1, 0, (1 - health) * .06, 1, 0, 0);
  context.drawImage(image, 0, sourceY, image.width, sourceHeight, -width / 2, 0, width, destinationHeight);
  context.restore();
}

function drawBuds(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  blossom: string,
  buds: number,
  bloom: number,
  health: number,
  count: number,
  radius: number,
  yScale: number,
) {
  if (buds <= .01) return;
  for (let index = 0; index < count; index += 1) {
    const reveal = smoothstep(index / count * .74, index / count * .74 + .26, buds);
    if (reveal <= .01) continue;
    const angle = index * 2.399;
    const r = Math.sqrt(index / count) * radius;
    const bx = x + Math.cos(angle) * r;
    const by = y + Math.sin(angle) * r * yScale + (1 - health) * 11;
    const size = 1.7 + reveal * (2.2 + bloom * 2.4);
    context.fillStyle = bloom > .35
      ? color("#efe0b2", "#a69b83", health, .42 + reveal * .5)
      : color(blossom, "#9a8c70", health, .4 + reveal * .46);
    context.beginPath();
    context.arc(bx, by, size, 0, Math.PI * 2);
    context.fill();
  }
}

export function drawWalker(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  time: number,
  moving: boolean,
  reducedMotion: boolean,
) {
  const bounce = reducedMotion ? 0 : moving ? Math.sin(time * .012) * 2.2 : Math.sin(time * .0022) * .55;
  context.save();
  context.translate(x, y + bounce);
  context.scale(zoom * 1.18, zoom * 1.18);
  const shadow = context.createRadialGradient(0, 5, 1, 0, 5, 17);
  shadow.addColorStop(0, "rgba(20,33,25,.32)");
  shadow.addColorStop(1, "rgba(20,33,25,0)");
  context.fillStyle = shadow;
  context.beginPath(); context.ellipse(0, 5, 17, 6, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#e9ecd3";
  context.beginPath(); context.roundRect(-8, -28, 16, 25, 7); context.fill();
  context.fillStyle = "#315445"; context.fillRect(-8, -16, 16, 13);
  context.strokeStyle = "#24372f"; context.lineWidth = 3;
  const step = moving && !reducedMotion ? Math.sin(time * .012) * 3 : 0;
  context.beginPath(); context.moveTo(-4, -3); context.lineTo(-6 + step, 5); context.moveTo(4, -3); context.lineTo(6 - step, 5); context.stroke();
  context.fillStyle = "#e3b28e"; context.beginPath(); context.arc(0, -34, 8, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#4b382f"; context.beginPath(); context.arc(0, -37, 8.5, Math.PI, Math.PI * 2); context.fill();
  context.restore();
}
