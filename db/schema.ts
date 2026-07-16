import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gardens = sqliteTable("gardens", {
  email: text("email").primaryKey(),
  publicId: text("public_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  habitsJson: text("habits_json").notNull().default("[]"),
  totalCompletions: integer("total_completions").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  gardenStage: integer("garden_stage").notNull().default(1),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
