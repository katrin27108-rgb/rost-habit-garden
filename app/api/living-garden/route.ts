import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { gardens } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { mergeLivingGardenSnapshots, sanitizeLivingGardenSnapshot } from "../../../lib/living-garden-sync";

const MAX_BODY_BYTES = 300_000;

function safeDisplayName(displayName: string, email: string) {
  return displayName === email ? "Садовник" : displayName.slice(0, 60);
}

function readStoredSnapshot(value: string | null) {
  if (!value) return null;
  try {
    return sanitizeLivingGardenSnapshot(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ signedIn: false }, { status: 401 });

  const [garden] = await getDb().select({
    livingGardenJson: gardens.livingGardenJson,
    livingGardenUpdatedAt: gardens.livingGardenUpdatedAt,
  }).from(gardens).where(eq(gardens.email, user.email)).limit(1);

  return Response.json({
    signedIn: true,
    user: { displayName: safeDisplayName(user.displayName, user.email) },
    snapshot: readStoredSnapshot(garden?.livingGardenJson ?? null),
    syncedAt: garden?.livingGardenUpdatedAt ?? null,
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return Response.json({ error: "Сад слишком большой для синхронизации" }, { status: 413 });

  let payload: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: "Сад слишком большой для синхронизации" }, { status: 413 });
    }
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Некорректные данные сада" }, { status: 400 });
  }
  const incoming = sanitizeLivingGardenSnapshot((payload as { snapshot?: unknown })?.snapshot);
  if (!incoming) return Response.json({ error: "Некорректные данные сада" }, { status: 400 });

  const db = getDb();
  const [existing] = await db.select({
    publicId: gardens.publicId,
    livingGardenJson: gardens.livingGardenJson,
  }).from(gardens).where(eq(gardens.email, user.email)).limit(1);
  const stored = readStoredSnapshot(existing?.livingGardenJson ?? null);
  const merged = stored ? mergeLivingGardenSnapshots(stored, incoming) : incoming;
  const syncedAt = new Date().toISOString();
  const displayName = safeDisplayName(user.displayName, user.email);
  const publicId = existing?.publicId ?? crypto.randomUUID();

  await db.insert(gardens).values({
    email: user.email,
    publicId,
    displayName,
    habitsJson: "[]",
    livingGardenJson: JSON.stringify(merged),
    livingGardenUpdatedAt: syncedAt,
    isPublic: false,
    updatedAt: syncedAt,
  }).onConflictDoUpdate({
    target: gardens.email,
    set: { livingGardenJson: JSON.stringify(merged), livingGardenUpdatedAt: syncedAt, updatedAt: syncedAt },
  });

  return Response.json({ saved: true, snapshot: merged, syncedAt });
}
