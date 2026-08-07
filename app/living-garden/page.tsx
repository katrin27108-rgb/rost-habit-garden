import type { Metadata } from "next";
import LivingPlantsPrototype from "./LivingPlantsPrototype";

export const metadata: Metadata = {
  title: "Живая оранжерея — пробная версия «Рост»",
  description: "Пробный 2D-формат сада привычек с живыми растениями и наглядным ростом.",
  openGraph: {
    title: "Твоя привычка становится живой",
    description: "Живая оранжерея — пробный 2D-формат сада привычек «Рост».",
    images: [{ url: "https://rost-habit-garden.katrin27108-rost.workers.dev/living-garden-og-v2.webp", width: 1732, height: 907 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Твоя привычка становится живой",
    description: "Живая оранжерея — пробный 2D-формат сада привычек «Рост».",
    images: ["https://rost-habit-garden.katrin27108-rost.workers.dev/living-garden-og-v2.webp"],
  },
};

export default function LivingGardenPage() {
  return <LivingPlantsPrototype />;
}
