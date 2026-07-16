import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { gardens } from "../../../db/schema";

type HabitPayload = {
  id: string;
  name: string;
  icon: string;
  color: string;
  completions: string[];
};

function safeDisplayName(displayName: string, email: string) {
  return displayName === email ? "Садовник" : displayName.slice(0, 60);
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ signedIn: false }, { status: 401 });

  const db = getDb();
  const [garden] = await db.select().from(gardens).where(eq(gardens.email, user.email)).limit(1);
  return Response.json({
    signedIn: true,
    user: { displayName: safeDisplayName(user.displayName, user.email) },
    garden: garden ? { habits: JSON.parse(garden.habitsJson), publicId: garden.publicId, isPublic: garden.isPublic } : null,
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const payload = await request.json() as {
    habits?: HabitPayload[];
    totalCompletions?: number;
    bestStreak?: number;
    gardenStage?: number;
  };
  if (!Array.isArray(payload.habits) || payload.habits.length > 80) {
    return Response.json({ error: "Некорректные привычки" }, { status: 400 });
  }

  const cleanHabits = payload.habits.map((habit) => ({
    id: String(habit.id).slice(0, 80),
    name: String(habit.name).slice(0, 80),
    icon: String(habit.icon).slice(0, 8),
    color: String(habit.color).slice(0, 20),
    completions: Array.isArray(habit.completions) ? habit.completions.map(String).slice(0, 2000) : [],
  }));
  const db = getDb();
  const [existing] = await db.select({ publicId: gardens.publicId }).from(gardens).where(eq(gardens.email, user.email)).limit(1);
  const publicId = existing?.publicId ?? crypto.randomUUID();
  const values = {
    email: user.email,
    publicId,
    displayName: safeDisplayName(user.displayName, user.email),
    habitsJson: JSON.stringify(cleanHabits),
    totalCompletions: Math.max(0, Number(payload.totalCompletions) || 0),
    bestStreak: Math.max(0, Number(payload.bestStreak) || 0),
    gardenStage: Math.min(4, Math.max(1, Number(payload.gardenStage) || 1)),
    isPublic: true,
    updatedAt: new Date().toISOString(),
  };

  await db.insert(gardens).values(values).onConflictDoUpdate({
    target: gardens.email,
    set: values,
  });
  return Response.json({ saved: true, publicId });
}
