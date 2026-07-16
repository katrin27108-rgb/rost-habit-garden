import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { gardens } from "../../../db/schema";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const db = getDb();
  const rows = await db.select({
    email: gardens.email,
    publicId: gardens.publicId,
    displayName: gardens.displayName,
    habitsJson: gardens.habitsJson,
    totalCompletions: gardens.totalCompletions,
    bestStreak: gardens.bestStreak,
    gardenStage: gardens.gardenStage,
    updatedAt: gardens.updatedAt,
  }).from(gardens)
    .where(eq(gardens.isPublic, true))
    .orderBy(desc(gardens.updatedAt))
    .limit(30);

  return Response.json({ gardens: rows.filter((row) => row.email !== user.email).map((row) => ({
    publicId: row.publicId,
    displayName: row.displayName,
    totalCompletions: row.totalCompletions,
    bestStreak: row.bestStreak,
    gardenStage: row.gardenStage,
    updatedAt: row.updatedAt,
    habits: JSON.parse(row.habitsJson),
    isMine: false,
  })) });
}
