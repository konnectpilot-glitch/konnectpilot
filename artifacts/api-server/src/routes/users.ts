import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  workspacesTable,
  workspaceMembersTable,
  brandsTable,
  postsTable,
  postingSchedulesTable,
  socialAccountsTable,
} from "@workspace/db";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateMeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function hasRoleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

// Ensure user exists in DB and has a personal workspace + ownership row.
// Backfills any of their legacy records (brands/posts/schedules/social accounts)
// that have no workspaceId so existing data continues to work after this migration.
async function ensureUser(clerkId: string, email: string) {
  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ clerkId, email, plan: "free" })
      .returning();
  }

  // Find or create personal workspace
  let [personal] = await db
    .select()
    .from(workspacesTable)
    .where(and(eq(workspacesTable.ownerId, user.id), eq(workspacesTable.isPersonal, true)));
  if (!personal) {
    [personal] = await db
      .insert(workspacesTable)
      .values({
        name: "Personal",
        ownerId: user.id,
        isPersonal: true,
      })
      .returning();
  }

  // Ensure owner membership row exists for the personal workspace
  const [membership] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, personal.id),
        eq(workspaceMembersTable.userId, user.id),
      ),
    );
  if (!membership) {
    await db.insert(workspaceMembersTable).values({
      workspaceId: personal.id,
      userId: user.id,
      role: "owner",
    });
  }

  // Backfill legacy records (one-shot — safe to run repeatedly: only updates rows
  // where workspaceId is null AND userId matches this user)
  await db
    .update(brandsTable)
    .set({ workspaceId: personal.id })
    .where(and(eq(brandsTable.userId, user.id), isNull(brandsTable.workspaceId)));
  await db
    .update(postingSchedulesTable)
    .set({ workspaceId: personal.id })
    .where(and(eq(postingSchedulesTable.userId, user.id), isNull(postingSchedulesTable.workspaceId)));
  await db
    .update(socialAccountsTable)
    .set({ workspaceId: personal.id })
    .where(and(eq(socialAccountsTable.userId, user.id), isNull(socialAccountsTable.workspaceId)));
  // Posts inherit workspace from brand
  await db.execute(sql`
    UPDATE posts SET workspace_id = b.workspace_id
    FROM brands b
    WHERE posts.brand_id = b.id
      AND posts.workspace_id IS NULL
      AND b.workspace_id IS NOT NULL
  `);

  if (!user.activeWorkspaceId) {
    [user] = await db
      .update(usersTable)
      .set({ activeWorkspaceId: personal.id })
      .where(eq(usersTable.id, user.id))
      .returning();
  }

  return user;
}

export async function requireAuth(req: any, res: any, next: any): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = userId;
  req.clerkEmail = (auth.sessionClaims?.email as string) || "";

  // Impersonation: a superadmin can pass X-Impersonate-User-Id to act as
  // another user for the duration of the request. We validate the requester
  // is a superadmin server-side and swap the effective Clerk identity to the
  // target user's. The original admin id is preserved on req.actualAdminId
  // for audit logging.
  const impersonateRaw = req.header("X-Impersonate-User-Id");
  if (impersonateRaw) {
    const targetId = parseInt(String(impersonateRaw), 10);
    if (!Number.isNaN(targetId)) {
      const requester = await ensureUser(req.clerkUserId, req.clerkEmail);
      if (requester.isSuperadmin) {
        const [target] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, targetId));
        if (target && target.id !== requester.id) {
          req.actualAdminId = requester.id;
          req.actualAdminEmail = requester.email;
          req.clerkUserId = target.clerkId;
          req.clerkEmail = target.email;
          req.isImpersonating = true;
          logger.info(
            { adminId: requester.id, targetUserId: target.id, path: req.path },
            "Admin impersonating user",
          );
        }
      }
    }
  }
  next();
}

/**
 * Resolves the user's active workspace (from `X-Workspace-Id` header or stored
 * activeWorkspaceId). Verifies membership. Sets:
 *   req.user, req.workspace, req.workspaceRole, req.workspaceId
 */
export async function requireWorkspace(req: any, res: any, next: any): Promise<void> {
  try {
    const user = await ensureUser(req.clerkUserId, req.clerkEmail);
    const headerId = Number(req.header("x-workspace-id"));
    let wsId = Number.isFinite(headerId) && headerId > 0 ? headerId : user.activeWorkspaceId;
    if (!wsId) {
      res.status(400).json({ error: "No active workspace" });
      return;
    }
    const [row] = await db
      .select({
        workspace: workspacesTable,
        role: workspaceMembersTable.role,
      })
      .from(workspacesTable)
      .innerJoin(
        workspaceMembersTable,
        and(
          eq(workspaceMembersTable.workspaceId, workspacesTable.id),
          eq(workspaceMembersTable.userId, user.id),
        ),
      )
      .where(eq(workspacesTable.id, wsId));
    if (!row) {
      res.status(403).json({ error: "Not a member of that workspace" });
      return;
    }
    req.user = user;
    req.workspace = row.workspace;
    req.workspaceId = row.workspace.id;
    req.workspaceRole = row.role as WorkspaceRole;
    next();
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Workspace resolution failed" });
  }
}

router.get("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  res.json(GetMeResponse.parse({
    ...user,
    isSuperadmin: user.isSuperadmin,
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
});

export async function requireSuperadmin(req: any, res: any, next: any): Promise<void> {
  if (!req.clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  if (!user.isSuperadmin) {
    res.status(403).json({ error: "Forbidden: superadmin only" });
    return;
  }
  req.adminUser = user;
  next();
}

router.patch("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json(UpdateMeResponse.parse({
    ...updated,
    trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  }));
});

export { ensureUser };
export default router;
