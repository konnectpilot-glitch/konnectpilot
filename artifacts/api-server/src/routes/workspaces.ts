import { Router, type IRouter } from "express";
import { eq, and, ne, gt } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
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
import { requireAuth, requireWorkspace, ensureUser, hasRoleAtLeast, type WorkspaceRole } from "./users";

const router: IRouter = Router();

const ROLES = ["owner", "admin", "editor", "viewer"] as const;
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function newToken() {
  return randomBytes(24).toString("base64url");
}

// List all workspaces this user belongs to
router.get("/workspaces", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const rows = await db
    .select({
      workspace: workspacesTable,
      role: workspaceMembersTable.role,
    })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspacesTable.id, workspaceMembersTable.workspaceId))
    .where(eq(workspaceMembersTable.userId, user.id))
    .orderBy(workspacesTable.createdAt);

  res.json({
    activeWorkspaceId: user.activeWorkspaceId,
    workspaces: rows.map((r) => ({
      id: r.workspace.id,
      name: r.workspace.name,
      isPersonal: r.workspace.isPersonal,
      requireApproval: r.workspace.requireApproval,
      role: r.role,
    })),
  });
});

router.post("/workspaces", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const body = z.object({ name: z.string().min(1).max(80) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [ws] = await db
    .insert(workspacesTable)
    .values({ name: body.data.name, ownerId: user.id })
    .returning();
  await db.insert(workspaceMembersTable).values({
    workspaceId: ws.id,
    userId: user.id,
    role: "owner",
  });
  res.status(201).json({ id: ws.id, name: ws.name, isPersonal: ws.isPersonal, role: "owner" });
});

router.post("/workspaces/switch", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const body = z.object({ workspaceId: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [member] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, body.data.workspaceId),
        eq(workspaceMembersTable.userId, user.id),
      ),
    );
  if (!member) {
    res.status(403).json({ error: "Not a member" });
    return;
  }
  await db
    .update(usersTable)
    .set({ activeWorkspaceId: body.data.workspaceId })
    .where(eq(usersTable.id, user.id));
  res.json({ ok: true, activeWorkspaceId: body.data.workspaceId });
});

router.patch("/workspaces/current", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const body = z
    .object({
      name: z.string().min(1).max(80).optional(),
      requireApproval: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [updated] = await db
    .update(workspacesTable)
    .set(body.data)
    .where(eq(workspacesTable.id, req.workspaceId))
    .returning();
  res.json(updated);
});

// Delete the current workspace. Owner only. Personal workspaces cannot be deleted.
router.delete("/workspaces/current", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (req.workspaceRole !== "owner") {
    res.status(403).json({ error: "Owner only" });
    return;
  }
  if (req.workspace.isPersonal) {
    res.status(400).json({ error: "Personal workspace cannot be deleted" });
    return;
  }
  // Workspace_id columns on brands/posts/schedules/social_accounts are not
  // FK-constrained, so we explicitly purge child rows to avoid orphaned data
  // visible to a future workspace that reuses the id.
  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ activeWorkspaceId: null })
      .where(eq(usersTable.activeWorkspaceId, req.workspaceId));
    await tx.delete(postingSchedulesTable).where(eq(postingSchedulesTable.workspaceId, req.workspaceId));
    await tx.delete(socialAccountsTable).where(eq(socialAccountsTable.workspaceId, req.workspaceId));
    // Brands cascade to posts/post-comments/brand-memory.
    await tx.delete(brandsTable).where(eq(brandsTable.workspaceId, req.workspaceId));
    // Catch any orphaned posts not under a brand in this workspace.
    await tx.delete(postsTable).where(eq(postsTable.workspaceId, req.workspaceId));
    // Workspace cascades to workspace_members and workspace_invitations.
    await tx.delete(workspacesTable).where(eq(workspacesTable.id, req.workspaceId));
  });
  res.sendStatus(204);
});

// Leave the current workspace (non-owner).
router.post("/workspaces/current/leave", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (req.workspaceRole === "owner") {
    res.status(400).json({ error: "Owners cannot leave — transfer ownership or delete the workspace first" });
    return;
  }
  await db
    .delete(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, req.workspaceId),
        eq(workspaceMembersTable.userId, req.user.id),
      ),
    );
  // Switch active to any other workspace.
  const [next] = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, req.user.id))
    .limit(1);
  await db
    .update(usersTable)
    .set({ activeWorkspaceId: next?.workspaceId ?? null })
    .where(eq(usersTable.id, req.user.id));
  res.json({ ok: true, activeWorkspaceId: next?.workspaceId ?? null });
});

// Transfer ownership to another member.
router.post("/workspaces/current/transfer", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (req.workspaceRole !== "owner") {
    res.status(403).json({ error: "Owner only" });
    return;
  }
  const body = z.object({ memberId: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [target] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.id, body.data.memberId),
        eq(workspaceMembersTable.workspaceId, req.workspaceId),
      ),
    );
  if (!target) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (target.userId === req.user.id) {
    res.status(400).json({ error: "Already the owner" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(workspaceMembersTable)
      .set({ role: "admin" })
      .where(
        and(
          eq(workspaceMembersTable.workspaceId, req.workspaceId),
          eq(workspaceMembersTable.userId, req.user.id),
        ),
      );
    await tx
      .update(workspaceMembersTable)
      .set({ role: "owner" })
      .where(eq(workspaceMembersTable.id, body.data.memberId));
    await tx
      .update(workspacesTable)
      .set({ ownerId: target.userId })
      .where(eq(workspacesTable.id, req.workspaceId));
  });
  res.json({ ok: true });
});

router.get("/workspaces/current/members", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  const rows = await db
    .select({
      id: workspaceMembersTable.id,
      userId: workspaceMembersTable.userId,
      role: workspaceMembersTable.role,
      email: usersTable.email,
      name: usersTable.name,
      createdAt: workspaceMembersTable.createdAt,
    })
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, workspaceMembersTable.userId))
    .where(eq(workspaceMembersTable.workspaceId, req.workspaceId))
    .orderBy(workspaceMembersTable.createdAt);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.patch("/workspaces/current/members/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const id = Number(req.params.id);
  const body = z.object({ role: z.enum(ROLES) }).safeParse(req.body);
  if (!body.success || !Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  if (body.data.role === "owner") {
    res.status(400).json({ error: "Use the transfer endpoint to change ownership" });
    return;
  }
  const [member] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.id, id),
        eq(workspaceMembersTable.workspaceId, req.workspaceId),
      ),
    );
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (member.role === "owner") {
    res.status(400).json({ error: "Cannot change owner role" });
    return;
  }
  // Only the owner can modify or demote another admin — prevents an admin
  // from seizing control by demoting peers.
  if (member.role === "admin" && req.workspaceRole !== "owner") {
    res.status(403).json({ error: "Only the owner can change another admin's role" });
    return;
  }
  const [updated] = await db
    .update(workspaceMembersTable)
    .set({ role: body.data.role })
    .where(eq(workspaceMembersTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/workspaces/current/members/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [member] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.id, id),
        eq(workspaceMembersTable.workspaceId, req.workspaceId),
      ),
    );
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (member.role === "owner") {
    res.status(400).json({ error: "Cannot remove the owner" });
    return;
  }
  // Only the owner can remove another admin.
  if (member.role === "admin" && req.workspaceRole !== "owner") {
    res.status(403).json({ error: "Only the owner can remove another admin" });
    return;
  }
  await db.delete(workspaceMembersTable).where(eq(workspaceMembersTable.id, id));
  // If the removed member was actively viewing this workspace, clear it.
  await db
    .update(usersTable)
    .set({ activeWorkspaceId: null })
    .where(and(eq(usersTable.id, member.userId), eq(usersTable.activeWorkspaceId, req.workspaceId)));
  res.sendStatus(204);
});

// ---- Invitations ----

// List pending invites for the current workspace
router.get("/workspaces/current/invites", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const rows = await db
    .select()
    .from(workspaceInvitationsTable)
    .where(
      and(
        eq(workspaceInvitationsTable.workspaceId, req.workspaceId),
        eq(workspaceInvitationsTable.status, "pending"),
      ),
    )
    .orderBy(workspaceInvitationsTable.createdAt);
  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      status: r.status,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

// Create an invite. If the email matches an existing user, add them directly
// as a member (matches the previous behavior). Otherwise create a pending
// invite token they can accept after signing up.
router.post("/workspaces/current/invites", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const body = z
    .object({
      email: z.string().email(),
      role: z.enum(ROLES).default("editor"),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.role === "owner") {
    res.status(400).json({ error: "Cannot directly assign owner role" });
    return;
  }
  const email = body.data.email.toLowerCase();

  // Existing user → add directly.
  const [target] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (target) {
    const [existing] = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.workspaceId, req.workspaceId),
          eq(workspaceMembersTable.userId, target.id),
        ),
      );
    if (existing) {
      res.status(409).json({ error: "Already a member" });
      return;
    }
    const [created] = await db
      .insert(workspaceMembersTable)
      .values({
        workspaceId: req.workspaceId,
        userId: target.id,
        role: body.data.role,
      })
      .returning();
    res.status(201).json({
      kind: "member",
      member: {
        id: created.id,
        userId: target.id,
        role: created.role,
        email: target.email,
        name: target.name,
        createdAt: created.createdAt.toISOString(),
      },
    });
    return;
  }

  // No account yet → create or refresh a pending invite.
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const token = newToken();
  const [existingInvite] = await db
    .select()
    .from(workspaceInvitationsTable)
    .where(
      and(
        eq(workspaceInvitationsTable.workspaceId, req.workspaceId),
        eq(workspaceInvitationsTable.email, email),
      ),
    );
  let invite;
  if (existingInvite) {
    [invite] = await db
      .update(workspaceInvitationsTable)
      .set({
        role: body.data.role,
        status: "pending",
        expiresAt,
        token,
        invitedById: req.user.id,
        acceptedAt: null,
      })
      .where(eq(workspaceInvitationsTable.id, existingInvite.id))
      .returning();
  } else {
    [invite] = await db
      .insert(workspaceInvitationsTable)
      .values({
        workspaceId: req.workspaceId,
        email,
        role: body.data.role,
        token,
        invitedById: req.user.id,
        expiresAt,
      })
      .returning();
  }
  res.status(201).json({
    kind: "invite",
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
    },
  });
});

router.delete("/workspaces/current/invites/:id", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
  if (!hasRoleAtLeast(req.workspaceRole, "admin")) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db
    .delete(workspaceInvitationsTable)
    .where(
      and(
        eq(workspaceInvitationsTable.id, id),
        eq(workspaceInvitationsTable.workspaceId, req.workspaceId),
      ),
    );
  res.sendStatus(204);
});

// List invites pending for the signed-in user (matched by email).
router.get("/invitations/mine", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  if (!user.email) { res.json([]); return; }
  const rows = await db
    .select({
      invite: workspaceInvitationsTable,
      workspaceName: workspacesTable.name,
    })
    .from(workspaceInvitationsTable)
    .innerJoin(workspacesTable, eq(workspacesTable.id, workspaceInvitationsTable.workspaceId))
    .where(
      and(
        eq(workspaceInvitationsTable.email, user.email.toLowerCase()),
        eq(workspaceInvitationsTable.status, "pending"),
        gt(workspaceInvitationsTable.expiresAt, new Date()),
      ),
    );
  res.json(
    rows.map((r) => ({
      id: r.invite.id,
      token: r.invite.token,
      role: r.invite.role,
      workspaceName: r.workspaceName,
      expiresAt: r.invite.expiresAt.toISOString(),
    })),
  );
});

router.post("/invitations/:token/accept", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const token = String(req.params.token);
  const [invite] = await db
    .select()
    .from(workspaceInvitationsTable)
    .where(eq(workspaceInvitationsTable.token, token));
  if (!invite || invite.status !== "pending") {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  if (invite.expiresAt < new Date()) {
    res.status(410).json({ error: "Invite expired" });
    return;
  }
  if (user.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
    res.status(403).json({ error: "Invite is for a different email" });
    return;
  }
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.workspaceId, invite.workspaceId),
          eq(workspaceMembersTable.userId, user.id),
        ),
      );
    if (!existing) {
      await tx.insert(workspaceMembersTable).values({
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
      });
    }
    await tx
      .update(workspaceInvitationsTable)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(workspaceInvitationsTable.id, invite.id));
  });
  // Make the newly joined workspace active for convenience.
  await db
    .update(usersTable)
    .set({ activeWorkspaceId: invite.workspaceId })
    .where(eq(usersTable.id, user.id));
  res.json({ ok: true, workspaceId: invite.workspaceId });
});

router.post("/invitations/:token/decline", requireAuth, async (req: any, res): Promise<void> => {
  const user = await ensureUser(req.clerkUserId, req.clerkEmail);
  const token = String(req.params.token);
  const [invite] = await db
    .select()
    .from(workspaceInvitationsTable)
    .where(eq(workspaceInvitationsTable.token, token));
  if (!invite || invite.status !== "pending") {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  if (user.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
    res.status(403).json({ error: "Invite is for a different email" });
    return;
  }
  await db
    .update(workspaceInvitationsTable)
    .set({ status: "declined" })
    .where(eq(workspaceInvitationsTable.id, invite.id));
  res.json({ ok: true });
});

// Suppress "ne" unused-import warning by keeping it referenced for future use.
void ne;

export default router;
