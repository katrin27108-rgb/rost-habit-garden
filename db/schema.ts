import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const gardenAccess = sqliteTable("garden_access", {
  ownerEmail: text("owner_email").notNull(),
  visitorEmail: text("visitor_email").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.ownerEmail, table.visitorEmail] })]);

export const userAccounts = sqliteTable("user_accounts", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const userSessions = sqliteTable("user_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
