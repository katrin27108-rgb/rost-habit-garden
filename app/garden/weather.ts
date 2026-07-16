import type { PrototypeQuality, PrototypeWeather } from "./types";

export type WeatherLook = {
  light: number;
  saturation: number;
  shadow: number;
  skyTint: string;
  groundTint: string;
};

export const WEATHER_LOOK: Record<PrototypeWeather, WeatherLook> = {
  clear: { light: 1, saturation: 1.06, shadow: .2, skyTint: "rgba(255,238,184,.04)", groundTint: "rgba(61,96,50,0)" },
  overcast: { light: .76, saturation: .74, shadow: .1, skyTint: "rgba(106,128,131,.25)", groundTint: "rgba(63,78,72,.16)" },
  rain: { light: .58, saturation: .66, shadow: .06, skyTint: "rgba(71,97,108,.38)", groundTint: "rgba(37,59,57,.28)" },
};

export function drawWeatherAtmosphere(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  weather: PrototypeWeather,
  time: number,
  quality: PrototypeQuality,
  reducedMotion: boolean,
) {
  const look = WEATHER_LOOK[weather];
  const sky = context.createLinearGradient(0, 0, 0, height * .7);
  sky.addColorStop(0, look.skyTint);
  sky.addColorStop(1, "rgba(30,54,46,0)");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height * .76);

  context.fillStyle = look.groundTint;
  context.fillRect(0, height * .45, width, height * .55);

  if (weather === "clear") {
    const drift = reducedMotion ? 0 : Math.sin(time * .00012) * width * .035;
    const ray = context.createLinearGradient(width * .05 + drift, 0, width * .62 + drift, height);
    ray.addColorStop(0, "rgba(255,246,199,.18)");
    ray.addColorStop(.38, "rgba(255,228,143,.07)");
    ray.addColorStop(.7, "rgba(255,228,143,0)");
    context.fillStyle = ray;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(width * .44, 0);
    context.lineTo(width * .78, height);
    context.lineTo(width * .25, height);
    context.closePath();
    context.fill();
  }

  if (weather !== "rain") return;

  const wet = context.createLinearGradient(0, height * .53, 0, height);
  wet.addColorStop(0, "rgba(168,202,187,0)");
  wet.addColorStop(1, "rgba(130,174,162,.18)");
  context.fillStyle = wet;
  context.fillRect(0, height * .5, width, height * .5);

  const dropCount = reducedMotion ? 16 : quality === "light" ? 42 : 86;
  const offset = reducedMotion ? 0 : (time * .58) % (height + 90);
  context.strokeStyle = "rgba(218,235,231,.5)";
  context.lineWidth = quality === "full" ? 1.15 : 1;
  for (let index = 0; index < dropCount; index += 1) {
    const x = ((index * 89 + (index % 7) * 23) % (width + 120)) - 60;
    const y = ((index * 137 + offset) % (height + 90)) - 60;
    const length = 12 + (index % 5) * 3;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - length * .32, y + length);
    context.stroke();
  }
}

