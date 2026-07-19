import type { PrototypeSpecies } from "../types";

export type SpeciesDesign = {
  species: PrototypeSpecies;
  trunk: string;
  trunkLight: string;
  leaf: string;
  leafLight: string;
  blossom: string;
  wind: number;
  matureHeight: number;
  matureWidth: number;
};

export const SPECIES_DESIGNS: Record<PrototypeSpecies, SpeciesDesign> = {
  oak: {
    species: "oak", trunk: "#4e3522", trunkLight: "#94704a", leaf: "#315e36", leafLight: "#6f944c",
    blossom: "#c9b078", wind: .42, matureHeight: 310, matureWidth: 250,
  },
  willow: {
    species: "willow", trunk: "#54442e", trunkLight: "#9b8359", leaf: "#426b42", leafLight: "#91a95b",
    blossom: "#c8d69b", wind: .92, matureHeight: 330, matureWidth: 285,
  },
  lavender: {
    species: "lavender", trunk: "#486043", trunkLight: "#7f966d", leaf: "#506f58", leafLight: "#8aa181",
    blossom: "#8066aa", wind: 1.12, matureHeight: 112, matureWidth: 156,
  },
};

export const smoothstep = (from: number, to: number, value: number) => {
  const x = Math.min(1, Math.max(0, (value - from) / Math.max(.001, to - from)));
  return x * x * (3 - 2 * x);
};

export function growthParts(progress: number) {
  return {
    root: smoothstep(.01, .13, progress),
    shoot: smoothstep(.05, .24, progress),
    trunk: smoothstep(.16, .58, progress),
    branches: smoothstep(.34, .72, progress),
    leaves: smoothstep(.48, .84, progress),
    buds: smoothstep(.66, .91, progress),
    bloom: smoothstep(.8, 1, progress),
  };
}

