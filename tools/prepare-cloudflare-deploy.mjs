import { existsSync, readFileSync, writeFileSync } from "node:fs";

const configPath = "dist/server/wrangler.json";
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim() || "rost-habit-garden";

if (!existsSync(configPath)) {
  throw new Error(`${configPath} is missing. Run npm run build first.`);
}
if (!databaseId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(databaseId)) {
  throw new Error("CLOUDFLARE_D1_DATABASE_ID must contain a valid D1 UUID.");
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const databases = Array.isArray(config.d1_databases) ? config.d1_databases : [];
const binding = { binding: "DB", database_name: databaseName, database_id: databaseId };
const index = databases.findIndex((entry) => entry?.binding === "DB");
if (index >= 0) databases[index] = { ...databases[index], ...binding };
else databases.push(binding);
config.d1_databases = databases;

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log("Prepared generated Wrangler configuration with the DB binding.");
