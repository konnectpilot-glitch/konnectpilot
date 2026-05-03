import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";

export const workspaceInvitationsTable = pgTable(
  "workspace_invitations",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("editor"),
    token: text("token").notNull().unique(),
    invitedById: integer("invited_by_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceEmailIdx: uniqueIndex("workspace_invitations_workspace_email_pending_idx").on(
      t.workspaceId,
      t.email,
    ),
  }),
);

export type WorkspaceInvitation = typeof workspaceInvitationsTable.$inferSelect;
