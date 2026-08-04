import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../db";
import { userAccounts, userSessions } from "../db/schema";

export const SESSION_COOKIE = "rost_session";
const SESSION_DAYS = 90;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return bytesToBase64(bytes);
}

export async function hashPassword(password: string, encodedSalt?: string) {
  const salt = encodedSalt ? base64ToBytes(encodedSalt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 120_000 }, key, 256);
  return { hash: bytesToBase64(new Uint8Array(bits)), salt: bytesToBase64(salt) };
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function createSession(email: string) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64(tokenBytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await getDb().insert(userSessions).values({ tokenHash, email, expiresAt });
  return { token, expiresAt };
}

export async function deleteSession(token: string) {
  await getDb().delete(userSessions).where(eq(userSessions.tokenHash, await sha256(token)));
}

export async function getStandaloneUser() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const token = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;

  const db = getDb();
  const [session] = await db.select().from(userSessions).where(eq(userSessions.tokenHash, await sha256(token))).limit(1);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.email, session.email)).limit(1);
  if (!account) return null;
  return { email: account.email, displayName: account.displayName, fullName: account.displayName };
}

export function sessionCookie(token: string, expiresAt: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
