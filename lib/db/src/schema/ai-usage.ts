import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const aiUsageTable = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    tokensUsed: integer("tokens_used"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userKindCreatedIdx: index("ai_usage_user_kind_created_idx").on(t.userId, t.kind, t.createdAt),
  }),
);

export type AiUsage = typeof aiUsageTable.$inferSelect;
export type AiUsageKind = "caption" | "image" | "video_script";
