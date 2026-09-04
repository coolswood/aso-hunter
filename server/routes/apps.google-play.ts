import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import {
  getGooglePlayCandidates,
  getGooglePlaySummary,
  syncGooglePlaySearchTerms,
} from "@/lib/googlePlayReports";

const googlePlayRoutes = new Hono();

googlePlayRoutes.get("/summary", async (c) => {
  const id = c.req.param("id")!;
  try {
    const summary = await getGooglePlaySummary(id);
    return c.json({ summary });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

googlePlayRoutes.get("/candidates", async (c) => {
  const id = c.req.param("id")!;
  const minAcquisitions = parseInt(c.req.query("minAcquisitions") ?? "1", 10) || 1;
  try {
    const candidates = await getGooglePlayCandidates(id, minAcquisitions);
    return c.json({ candidates });
  } catch (e) {
    return c.json({ error: (e as Error).message, candidates: [] }, 500);
  }
});

googlePlayRoutes.post("/sync", async (c) => {
  const id = c.req.param("id")!;
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, id),
  });

  if (!app) {
    return c.json({ error: "App not found" }, 404);
  }

  if (app.platform !== "ANDROID") {
    return c.json(
      { error: "Google Play Console reports are only available for Android apps" },
      400,
    );
  }

  try {
    const result = await syncGooglePlaySearchTerms(app.id, app.storeId, 24);
    const summary = await getGooglePlaySummary(app.id);
    return c.json({ success: true, result, summary });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

export default googlePlayRoutes;
