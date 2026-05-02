import { pgTable, text, serial, timestamp, integer, type AnyPgColumn } from "drizzle-orm/pg-core";
import { postsTable } from "./posts";
import { usersTable } from "./users";

export const postCommentsTable = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references((): AnyPgColumn => postCommentsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PostComment = typeof postCommentsTable.$inferSelect;
