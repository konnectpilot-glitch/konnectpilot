import { Router, type IRouter } from "express";
import { count, eq } from "drizzle-orm";
import { db, postsTable } from "@workspace/db";

// Public stats — totally unauthenticated, returns aggregate numbers safe to
// show on the marketing landing page. Currently just total published posts
// across all workspaces, but designed to grow (active users last 30 days,
// brands using the platform, etc.). Cached in-memory for 5 min so a viral
// landing visit doesn't slam the DB.

const router: IRouter = Router();

interface PublicStats {
  postsPublished: number;
  asOfMonth: string;
}

let cache: { value: PublicStats; cachedAt: number } | null = null;
const CACHE_MS = 5 * 60_000;

router.get("/public/stats", async (_req, res): Promise<void> => {
  if (cache && Date.now() - cache.cachedAt < CACHE_MS) {
    res.json(cache.value);
    return;
  }
  try {
    const [{ c }] = await db
      .select({ c: count() })
      .from(postsTable)
      .where(eq(postsTable.status, "published"));
    const value: PublicStats = {
      postsPublished: Number(c ?? 0),
      asOfMonth: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
    };
    cache = { value, cachedAt: Date.now() };
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(value);
  } catch {
    // On DB failure, return a safe fallback (still public, never errors —
    // this endpoint is on the marketing landing).
    res.json({ postsPublished: 0, asOfMonth: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }) });
  }
});

export default router;
