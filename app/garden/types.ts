export type PrototypeWeather = "clear" | "overcast" | "rain";
export type PrototypeSpecies = "oak" | "willow" | "lavender";
export type PrototypeHealth = "healthy" | "drooping" | "wilted" | "sleeping";
export type PrototypeQuality = "full" | "light";

export type GardenCamera = { x: number; y: number };
export type GardenWalker = { x: number; y: number };

export type PrototypePlant = {
  species: PrototypeSpecies;
  x: number;
  y: number;
  progress: number;
  health: number;
  featured?: boolean;
};

export const HEALTH_VALUES: Record<PrototypeHealth, number> = {
  healthy: 1,
  drooping: .72,
  wilted: .42,
  sleeping: .2,
};

export const WEATHER_LABELS: Record<PrototypeWeather, string> = {
  clear: "Ясно",
  overcast: "Пасмурно",
  rain: "Дождь",
};

export const SPECIES_LABELS: Record<PrototypeSpecies, string> = {
  oak: "Дуб",
  willow: "Ива",
  lavender: "Лаванда",
};

