import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  usersTable,
  workspacesTable,
  workspaceMembersTable,
} from "@workspace/db";
import { requireAuth, requireWorkspace, ensureUser, hasRoleAtLeast, type WorkspaceRole } from "./users";

const router: IRouter = Router();

const ROLES = ["owner", "admin", "editor", "viewer"] as const;

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

// Switch the user's active workspace
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

router.post("/workspaces/current/members", requireAuth, requireWorkspace, async (req: any, res): Promise<void> => {
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
  const [target] = await db.select().from(usersTable).where(eq(usersTable.email, body.data.email));
  if (!target) {
    res.status(404).json({ error: "No user with that email — they need to sign up first" });
    return;
  }
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
    id: created.id,
    userId: target.id,
    role: created.role,
    email: target.email,
    name: target.name,
    createdAt: created.createdAt.toISOString(),
  });
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
    res.status(400).json({ error: "Cannot promote to owner" });
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
  await db.delete(workspaceMembersTable).where(eq(workspaceMembersTable.id, id));
  res.sendStatus(204);
});

export default router;
