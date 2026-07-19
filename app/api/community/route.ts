import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { gardenAccess, gardens } from "../../../db/schema";
import { isStoredHabit, metricsForHabit, type StoredHabit } from "../../../lib/app-model";
import type { DateKey } from "../../../lib/domain";

function todayKey(): DateKey {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` as DateKey;
}

function safeHabits(value: string): StoredHabit[] {
  try {
    const parsed = JSON.parse(value) as unknown[];
    return Array.isArray(parsed) ? parsed.filter(isStoredHabit).filter((habit) => habit.status !== "deleted") : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const db = getDb();
  const visible = await db.select({ garden: gardens }).from(gardenAccess)
    .innerJoin(gardens, eq(gardenAccess.ownerEmail, gardens.email))
    .where(eq(gardenAccess.visitorEmail, user.email));
  const sharedRows = await db.select({ visitorEmail: gardenAccess.visitorEmail }).from(gardenAccess)
    .where(eq(gardenAccess.ownerEmail, user.email));
  const today = todayKey();
  const result = visible.map(({ garden }) => {
    const habits = safeHabits(garden.habitsJson);
    return {
      publicId: garden.publicId,
      displayName: garden.displayName,
      plants: habits.map((habit) => ({
        id: habit.id,
        kind: habit.plantKind,
        slot: habit.gardenSlot,
        color: habit.color,
        progress: metricsForHabit(habit, today).progress,
        health: metricsForHabit(habit, today).health,
      })),
      plantCount: habits.length,
      totalCompletions: garden.totalCompletions,
      bestStreak: garden.bestStreak,
      gardenStage: garden.gardenStage,
      updatedAt: garden.updatedAt,
    };
  });
  return Response.json({ gardens: result, sharedWith: sharedRows.map((row) => row.visitorEmail), accessMode: "invitation-only" });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { visitorEmail?: string };
  const visitorEmail = String(payload.visitorEmail ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail) || visitorEmail === user.email.toLowerCase()) {
    return Response.json({ error: "Укажите почту другого пользователя" }, { status: 400 });
  }
  const db = getDb();
  await db.insert(gardenAccess).values({ ownerEmail: user.email, visitorEmail }).onConflictDoNothing();
  return Response.json({ invited: true, visitorEmail });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { visitorEmail?: string };
  const visitorEmail = String(payload.visitorEmail ?? "").trim().toLowerCase();
  const db = getDb();
  await db.delete(gardenAccess).where(and(eq(gardenAccess.ownerEmail, user.email), eq(gardenAccess.visitorEmail, visitorEmail)));
  return Response.json({ revoked: true });
}
