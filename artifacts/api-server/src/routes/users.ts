import { Router, type IRouter } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  workspacesTable,
  workspaceMembersTable,
  workspaceInvitationsTable,
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
// Comma-separated list of emails (case-insensitive) that should always be
// granted superadmin on sign-in. Used to bootstrap the first admin in a
// fresh deployment where no DB write tooling is available.
function superadminEmails(): Set<string> {
  return new Set(
    (process.env.SUPERADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function ensureUser(clerkId: string, email: string) {
  // Fast path: user already exists, no bootstrap needed.
  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  let personal: typeof workspacesTable.$inferSelect | undefined;

  if (!user) {
    // Bootstrap path. The dashboard fires many parallel requests on first
    // sign-in — all of them call ensureUser concurrently. Without
    // serialization, multiple requests would race to INSERT the user and the
    // personal workspace, causing unique-constraint 500s and/or duplicate
    // "Personal" workspaces. We serialize the bootstrap on a Postgres advisory
    // transaction lock keyed on the Clerk id: only one request per user runs
    // the bootstrap at a time; the rest wait, then take the fast path on
    // re-SELECT.
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${clerkId}, 0))`);

      // Re-check inside the lock — a previous waiter may have already created
      // the user.
      [user] = await tx.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
      if (!user) {
        // Clerk's default session JWT doesn't include the `email` claim, so
        // when creating a brand-new user we may need to fetch it from Clerk's
        // API to satisfy the NOT NULL UNIQUE constraint on users.email.
        let resolvedEmail = email;
        if (!resolvedEmail) {
          try {
            const clerkUser = await clerkClient.users.getUser(clerkId);
            const primaryId = clerkUser.primaryEmailAddressId;
            const primary =
              clerkUser.emailAddresses.find((e: any) => e.id === primaryId) ??
              clerkUser.emailAddresses[0];
            resolvedEmail = primary?.emailAddress ?? "";
          } catch {
            // fall through — handled below
          }
        }
        if (!resolvedEmail) {
          // Last-resort placeholder so we never insert an empty string (which
          // would collide with the unique index for any other user missing an
          // email).
          resolvedEmail = `${clerkId}@users.noreply.konnectpilot.local`;
        }
        [user] = await tx
          .insert(usersTable)
          .values({ clerkId, email: resolvedEmail, plan: "free" })
          .returning();
      }

      // Personal workspace.
      [personal] = await tx
        .select()
        .from(workspacesTable)
        .where(
          and(eq(workspacesTable.ownerId, user.id), eq(workspacesTable.isPersonal, true)),
        );
      if (!personal) {
        [personal] = await tx
          .insert(workspacesTable)
          .values({ name: "Personal", ownerId: user.id, isPersonal: true })
          .returning();
      }

      // Owner membership.
      const [membership] = await tx
        .select()
        .from(workspaceMembersTable)
        .where(
          and(
            eq(workspaceMembersTable.workspaceId, personal.id),
            eq(workspaceMembersTable.userId, user.id),
          ),
        );
      if (!membership) {
        await tx
          .insert(workspaceMembersTable)
          .values({ workspaceId: personal.id, userId: user.id, role: "owner" })
          .onConflictDoNothing();
      }
    });
  }

  // For existing users we still need `personal` for the legacy backfill below
  // and the activeWorkspaceId fallback further down.
  if (!personal) {
    [personal] = await db
      .select()
      .from(workspacesTable)
      .where(
        and(eq(workspacesTable.ownerId, user.id), eq(workspacesTable.isPersonal, true)),
      );
  }
  if (!personal) {
    // Existing user without a personal workspace (e.g. a legacy account
    // created before the workspaces migration). Lazily create one + the
    // owner membership row so auth flows don't 500. Use the same advisory
    // lock as the new-user bootstrap to serialize concurrent requests.
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${clerkId}, 0))`);
      [personal] = await tx
        .select()
        .from(workspacesTable)
        .where(
          and(eq(workspacesTable.ownerId, user.id), eq(workspacesTable.isPersonal, true)),
        );
      if (!personal) {
        [personal] = await tx
          .insert(workspacesTable)
          .values({ name: "Personal", ownerId: user.id, isPersonal: true })
          .returning();
      }
      await tx
        .insert(workspaceMembersTable)
        .values({ workspaceId: personal!.id, userId: user.id, role: "owner" })
        .onConflictDoNothing();
    });
  }

  // Backfill legacy records owned by THIS user only. All filters are
  // scoped by user.id so concurrent calls from other users never mutate
  // each other's rows.
  await db
    .update(brandsTable)
    .set({ workspaceId: personal!.id })
    .where(and(eq(brandsTable.userId, user.id), isNull(brandsTable.workspaceId)));
  await db
    .update(postingSchedulesTable)
    .set({ workspaceId: personal!.id })
    .where(and(eq(postingSchedulesTable.userId, user.id), isNull(postingSchedulesTable.workspaceId)));
  await db
    .update(socialAccountsTable)
    .set({ workspaceId: personal!.id })
    .where(and(eq(socialAccountsTable.userId, user.id), isNull(socialAccountsTable.workspaceId)));
  // Posts inherit workspace from brand — scoped to this user's brands so
  // we never touch other tenants' rows.
  await db.execute(sql`
    UPDATE posts SET workspace_id = b.workspace_id
    FROM brands b
    WHERE posts.brand_id = b.id
      AND posts.workspace_id IS NULL
      AND b.workspace_id IS NOT NULL
      AND b.user_id = ${user.id}
  `);

  // Auto-accept any pending invitations addressed to this user's email so
  // teammates invited before signup get instant access.
  if (user.email) {
    const pendingInvites = await db
      .select()
      .from(workspaceInvitationsTable)
      .where(
        and(
          eq(workspaceInvitationsTable.email, user.email.toLowerCase()),
          eq(workspaceInvitationsTable.status, "pending"),
        ),
      );
    for (const invite of pendingInvites) {
      if (invite.expiresAt < new Date()) continue;
      await db.transaction(async (tx) => {
        await tx
          .insert(workspaceMembersTable)
          .values({
            workspaceId: invite.workspaceId,
            userId: user!.id,
            role: invite.role,
          })
          .onConflictDoNothing();
        await tx
          .update(workspaceInvitationsTable)
          .set({ status: "accepted", acceptedAt: new Date() })
          .where(eq(workspaceInvitationsTable.id, invite.id));
      });
    }
  }

  if (!user.activeWorkspaceId) {
    [user] = await db
      .update(usersTable)
      .set({ activeWorkspaceId: personal.id })
      .where(eq(usersTable.id, user.id))
      .returning();
  }

  // Auto-promote configured emails to superadmin (idempotent). Runs on every
  // sign-in for both new and existing users so a fresh deployment can
  // bootstrap its first admin via the SUPERADMIN_EMAILS env var without
  // needing direct DB write access.
  if (!user.isSuperadmin) {
    const allow = superadminEmails();
    if (user.email && allow.has(user.email.toLowerCase())) {
      [user] = await db
        .update(usersTable)
        .set({ isSuperadmin: true })
        .where(eq(usersTable.id, user.id))
        .returning();
    }
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
