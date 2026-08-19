import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable, messagesTable } from "@workspace/db";
import { SendChatBody } from "@workspace/api-zod";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "../lib/logger";

const router = Router();

// Build conversation history for a session
async function buildHistory(
  sessionId: number,
): Promise<Array<{ role: string; content: string }>> {
  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, sessionId))
    .orderBy(messagesTable.createdAt)
    .limit(40);
  return msgs.map((m) => ({ role: m.role, content: m.content }));
}

// POST /ai/chat — non-streaming, saves messages to DB
router.post("/ai/chat", async (req: Request, res: Response) => {
  const parsed = SendChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const {
    sessionId,
    message,
    model = "grok-3",
    webSearch = false,
  } = parsed.data;

  const session = await db.query.sessionsTable.findFirst({
    where: eq(sessionsTable.id, sessionId),
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Save user message
  await db
    .insert(messagesTable)
    .values({ sessionId, role: "user", content: message });

  const history = await buildHistory(sessionId);

  try {
    const connectors = new ReplitConnectors();
    const tools = webSearch ? [{ type: "web_search" }] : undefined;
    const body: Record<string, unknown> = {
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert software engineer and DevOps assistant. Help the user write code, configuration files, deployment scripts, and system administration commands. When generating file content, wrap it in a markdown code block with the appropriate language tag. Be concise and precise.",
        },
        ...history,
      ],
      max_tokens: 4096,
    };
    if (tools) body.tools = tools;

    const response = await connectors.proxy("xai", "/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error({ err }, "xAI API error");
      res.status(500).json({ error: "AI request failed" });
      return;
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content ?? "";

    // Save assistant message
    const [saved] = await db
      .insert(messagesTable)
      .values({ sessionId, role: "assistant", content })
      .returning();

    // Touch session updatedAt
    await db
      .update(sessionsTable)
      .set({ updatedAt: new Date() })
      .where(eq(sessionsTable.id, sessionId));

    res.json(saved);
  } catch (err) {
    logger.error({ err }, "Error calling xAI");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /ai/stream — Server-Sent Events streaming response
router.post("/ai/stream", async (req: Request, res: Response) => {
  const parsed = SendChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const {
    sessionId,
    message,
    model = "grok-3",
    webSearch = false,
  } = parsed.data;

  const session = await db.query.sessionsTable.findFirst({
    where: eq(sessionsTable.id, sessionId),
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Save user message
  await db
    .insert(messagesTable)
    .values({ sessionId, role: "user", content: message });

  const history = await buildHistory(sessionId);

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const connectors = new ReplitConnectors();
    const tools = webSearch ? [{ type: "web_search" }] : undefined;
    const body: Record<string, unknown> = {
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert software engineer and DevOps assistant. Help the user write code, configuration files, deployment scripts, and system administration commands. When generating file content, wrap it in a markdown code block with the appropriate language tag. Be concise and precise.",
        },
        ...history,
      ],
      stream: true,
      max_tokens: 4096,
    };
    if (tools) body.tools = tools;

    const response = await connectors.proxy("xai", "/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error({ err }, "xAI stream error");
      send({ done: true, error: "AI request failed" });
      res.end();
      return;
    }

    // Pipe SSE from xAI to client
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const chunk = line.slice(6).trim();
        if (chunk === "[DONE]") continue;
        try {
          const parsed = JSON.parse(chunk) as {
            choices: Array<{ delta: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            fullContent += delta;
            send({ delta, done: false });
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    // Save assistant message
    if (fullContent) {
      await db
        .insert(messagesTable)
        .values({ sessionId, role: "assistant", content: fullContent });

      await db
        .update(sessionsTable)
        .set({ updatedAt: new Date() })
        .where(eq(sessionsTable.id, sessionId));
    }

    send({ done: true, fullContent });
    res.end();
  } catch (err) {
    logger.error({ err }, "Stream error");
    send({ done: true, error: "Internal server error" });
    res.end();
  }
});

export default router;
