import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { userAccounts } from "../../../db/schema";
import { constantTimeEqual, createSession, hashPassword, sessionCookie } from "../../standalone-auth";

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase().slice(0, 180);
}

export async function POST(request: Request) {
  const payload = await request.json() as { mode?: string; email?: string; password?: string; displayName?: string };
  const mode = payload.mode === "register" ? "register" : "login";
  const email = cleanEmail(payload.email);
  const password = String(payload.password ?? "");
  const displayName = String(payload.displayName ?? "").trim().slice(0, 60) || "Садовник";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Проверьте адрес почты" }, { status: 400 });
  if (password.length < 8 || password.length > 128) return Response.json({ error: "Пароль должен содержать от 8 до 128 символов" }, { status: 400 });

  const db = getDb();
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.email, email)).limit(1);
  if (mode === "register") {
    if (account) return Response.json({ error: "Аккаунт с такой почтой уже существует" }, { status: 409 });
    const passwordData = await hashPassword(password);
    await db.insert(userAccounts).values({ email, displayName, passwordHash: passwordData.hash, passwordSalt: passwordData.salt });
  } else {
    if (!account) return Response.json({ error: "Неверная почта или пароль" }, { status: 401 });
    const candidate = await hashPassword(password, account.passwordSalt);
    if (!constantTimeEqual(candidate.hash, account.passwordHash)) return Response.json({ error: "Неверная почта или пароль" }, { status: 401 });
  }

  const session = await createSession(email);
  return Response.json({ signedIn: true, displayName: mode === "register" ? displayName : account?.displayName ?? displayName }, {
    headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) },
  });
}
