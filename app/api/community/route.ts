import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  // The legacy D1 table has no invitation permissions. Returning no gardens is
  // safer than exposing data until the Supabase invitation RPC is connected.
  return Response.json({ gardens: [], accessMode: "invitation-only" });
}
