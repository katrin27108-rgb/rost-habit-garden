import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Рост — живой трекер привычек",
  description: "Трекер привычек, в котором каждое выполненное дело выращивает твой личный сад.",
  applicationName: "Рост",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Рост",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f0e9",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
