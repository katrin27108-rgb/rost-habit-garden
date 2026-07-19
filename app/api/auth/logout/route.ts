import { headers } from "next/headers";
import { deleteSession, expiredSessionCookie, SESSION_COOKIE } from "../../../standalone-auth";

export async function POST() {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const token = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (token) await deleteSession(token);
  return Response.json({ signedOut: true }, { headers: { "Set-Cookie": expiredSessionCookie() } });
}
