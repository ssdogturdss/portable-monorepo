import { Router } from "express";
import { eq, desc, count, sql, and } from "drizzle-orm";
import { db, sessionsTable, messagesTable } from "@workspace/db";
import {
  CreateSessionBody,
  GetSessionParams,
  DeleteSessionParams,
  GetSessionMessagesParams,
} from "@workspace/api-zod";

const router = Router();

// GET /ai/sessions
router.get("/ai/sessions", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .orderBy(desc(sessionsTable.updatedAt));
  res.json(sessions);
});

// POST /ai/sessions
router.post("/ai/sessions", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { title, model = "grok-3" } = parsed.data;
  const [session] = await db
    .insert(sessionsTable)
    .values({ userId, title, model })
    .returning();
  res.status(201).json(session);
});

// GET /ai/sessions/recent — must come before /:sessionId
router.get("/ai/sessions/recent", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const rows = await db
    .select({
      id: sessionsTable.id,
      title: sessionsTable.title,
      model: sessionsTable.model,
      updatedAt: sessionsTable.updatedAt,
      messageCount: count(messagesTable.id),
      lastMessage: sql<string | null>`
        (SELECT content FROM messages
         WHERE session_id = ${sessionsTable.id}
         ORDER BY created_at DESC
         LIMIT 1)
      `,
    })
    .from(sessionsTable)
    .leftJoin(messagesTable, eq(messagesTable.sessionId, sessionsTable.id))
    .where(eq(sessionsTable.userId, userId))
    .groupBy(sessionsTable.id)
    .orderBy(desc(sessionsTable.updatedAt))
    .limit(20);
  res.json(rows);
});

// GET /ai/sessions/:sessionId
router.get("/ai/sessions/:sessionId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const parsed = GetSessionParams.safeParse({
    sessionId: Number(req.params.sessionId),
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }
  const { sessionId } = parsed.data;
  const session = await db.query.sessionsTable.findFirst({
    where: and(
      eq(sessionsTable.id, sessionId),
      eq(sessionsTable.userId, userId),
    ),
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, sessionId))
    .orderBy(messagesTable.createdAt);
  res.json({ ...session, messages });
});

// DELETE /ai/sessions/:sessionId
router.delete("/ai/sessions/:sessionId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const parsed = DeleteSessionParams.safeParse({
    sessionId: Number(req.params.sessionId),
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }
  await db
    .delete(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, parsed.data.sessionId),
        eq(sessionsTable.userId, userId),
      ),
    );
  res.status(204).end();
});

// GET /ai/sessions/:sessionId/messages
router.get("/ai/sessions/:sessionId/messages", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const parsed = GetSessionMessagesParams.safeParse({
    sessionId: Number(req.params.sessionId),
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }
  // Verify session belongs to user
  const session = await db.query.sessionsTable.findFirst({
    where: and(
      eq(sessionsTable.id, parsed.data.sessionId),
      eq(sessionsTable.userId, userId),
    ),
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, parsed.data.sessionId))
    .orderBy(messagesTable.createdAt);
  res.json(messages);
});

export default router;
