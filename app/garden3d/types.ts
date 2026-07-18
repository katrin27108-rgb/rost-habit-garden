export type GardenWeather = "clear" | "overcast" | "rain";
export type GardenHealth = "healthy" | "drooping" | "wilted" | "sleeping";
export type GardenQuality = "full" | "light";
export type GardenView = "overview" | "walk";

export type GardenState = {
  growth: number;
  health: GardenHealth;
  weather: GardenWeather;
  quality: GardenQuality;
  view: GardenView;
};

export type MutableGardenState = {
  growth: number;
  health: number;
  weather: GardenWeather;
  quality: GardenQuality;
  view: GardenView;
};

export const HEALTH_TARGETS: Record<GardenHealth, number> = {
  healthy: 1,
  drooping: .68,
  wilted: .34,
  sleeping: .18,
};

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
