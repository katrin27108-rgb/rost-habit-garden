import type { GardenCamera, PrototypeQuality, PrototypeWeather } from "./types";
import { WEATHER_LOOK, drawWeatherAtmosphere } from "./weather";

type EnvironmentOptions = {
  context: CanvasRenderingContext2D;
  image: HTMLImageElement;
  width: number;
  height: number;
  camera: GardenCamera;
  weather: PrototypeWeather;
  quality: PrototypeQuality;
  time: number;
  reducedMotion: boolean;
};

function coverRect(image: HTMLImageElement, width: number, height: number, overscan: number) {
  const scale = Math.max(width / image.width, height / image.height) * overscan;
  return { width: image.width * scale, height: image.height * scale };
}

export function drawEnvironment(options: EnvironmentOptions) {
  const { context, image, width, height, camera, weather, quality, time, reducedMotion } = options;
  const size = coverRect(image, width, height, 1.11);
  const look = WEATHER_LOOK[weather];

  context.save();
  context.filter = `brightness(${look.light}) saturate(${look.saturation}) contrast(${weather === "clear" ? 1.04 : .96})`;
  // The master painting is projected as three independently moving depth bands.
  // Soft overlaps and atmospheric veils hide their joins while preserving one art style.
  drawPaintedBand(context, image, width, height, size, 0, .52, camera, .025, .012);
  drawPaintedBand(context, image, width, height, size, .43, .34, camera, .072, .024);
  drawPaintedBand(context, image, width, height, size, .68, .32, camera, .135, .038);
  context.restore();

  const distanceVeil = context.createLinearGradient(0, height * .38, 0, height * .58);
  distanceVeil.addColorStop(0, "rgba(226,232,211,0)");
  distanceVeil.addColorStop(.48, weather === "clear" ? "rgba(226,232,211,.1)" : "rgba(183,199,194,.14)");
  distanceVeil.addColorStop(1, "rgba(226,232,211,0)");
  context.fillStyle = distanceVeil;
  context.fillRect(0, height * .34, width, height * .28);

  const haze = context.createLinearGradient(0, height * .08, 0, height * .62);
  haze.addColorStop(0, weather === "clear" ? "rgba(244,238,211,.17)" : "rgba(190,204,200,.25)");
  haze.addColorStop(.55, weather === "clear" ? "rgba(235,236,205,.08)" : "rgba(151,174,170,.13)");
  haze.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = haze;
  context.fillRect(0, 0, width, height * .68);

  drawWaterLight(context, width, height, time, weather, quality, reducedMotion);
  drawWeatherAtmosphere(context, width, height, weather, time, quality, reducedMotion);
  drawForegroundDepth(context, width, height, camera, time, quality, reducedMotion, weather);

  const vignette = context.createRadialGradient(width * .5, height * .5, Math.min(width, height) * .18, width * .5, height * .52, Math.max(width, height) * .72);
  vignette.addColorStop(.45, "rgba(11,29,21,0)");
  vignette.addColorStop(1, weather === "rain" ? "rgba(8,22,20,.38)" : "rgba(8,28,18,.22)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function drawPaintedBand(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  viewportWidth: number,
  viewportHeight: number,
  size: { width: number; height: number },
  top: number,
  portion: number,
  camera: GardenCamera,
  parallaxX: number,
  parallaxY: number,
) {
  const clipTop = Math.max(0, viewportHeight * top - 34);
  const clipHeight = Math.min(viewportHeight - clipTop, viewportHeight * portion + 68);
  const x = (viewportWidth - size.width) / 2 - camera.x * parallaxX;
  const y = (viewportHeight - size.height) / 2 - camera.y * parallaxY;
  context.save();
  context.beginPath();
  context.rect(0, clipTop, viewportWidth, clipHeight);
  context.clip();
  context.drawImage(image, x, y, size.width, size.height);
  context.restore();
}

function drawWaterLight(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  weather: PrototypeWeather,
  quality: PrototypeQuality,
  reducedMotion: boolean,
) {
  const cx = width * .16;
  const cy = height * .79;
  const rx = width * .23;
  const ry = height * .16;
  context.save();
  context.beginPath();
  context.ellipse(cx, cy, rx, ry, -.06, 0, Math.PI * 2);
  context.clip();
  const sheen = context.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  sheen.addColorStop(0, weather === "rain" ? "rgba(185,211,205,.08)" : "rgba(239,246,215,.17)");
  sheen.addColorStop(.5, "rgba(192,232,221,.04)");
  sheen.addColorStop(1, weather === "clear" ? "rgba(255,231,156,.13)" : "rgba(90,128,128,.1)");
  context.fillStyle = sheen;
  context.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  const rippleCount = quality === "full" ? 8 : 4;
  context.strokeStyle = weather === "rain" ? "rgba(218,235,230,.38)" : "rgba(238,248,223,.34)";
  context.lineWidth = 1.1;
  for (let i = 0; i < rippleCount; i += 1) {
    const phase = reducedMotion ? i * .12 : (time * .00022 + i * .17) % 1;
    const px = cx - rx * .55 + ((i * 67) % Math.max(1, rx * 1.25));
    const py = cy - ry * .38 + ((i * 29) % Math.max(1, ry * .7));
    context.globalAlpha = 1 - phase;
    context.beginPath();
    context.ellipse(px, py, 8 + phase * 32, 3 + phase * 11, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
  context.globalAlpha = 1;
}

function drawForegroundDepth(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: GardenCamera,
  time: number,
  quality: PrototypeQuality,
  reducedMotion: boolean,
  weather: PrototypeWeather,
) {
  const blades = quality === "full" ? 54 : 24;
  const wind = reducedMotion ? 0 : Math.sin(time * .00075) * (weather === "rain" ? 4 : 2.4);
  context.save();
  context.translate(-camera.x * .13, 0);
  for (let i = 0; i < blades; i += 1) {
    const x = ((i * 97 + (i % 7) * 31) % (width + 180)) - 90;
    const baseY = height + 6;
    const length = 24 + (i % 9) * 5;
    context.strokeStyle = i % 3 === 0 ? "rgba(36,69,38,.58)" : "rgba(67,104,54,.48)";
    context.lineWidth = 1.2 + (i % 3) * .55;
    context.beginPath();
    context.moveTo(x, baseY);
    context.quadraticCurveTo(x + wind + (i % 5) - 2, baseY - length * .58, x + wind * 1.6, baseY - length);
    context.stroke();
  }
  context.restore();
}
