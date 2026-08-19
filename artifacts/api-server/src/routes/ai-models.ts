import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router = Router();

router.get("/ai/models", async (_req, res) => {
  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy("xai", "/v1/language-models");
    if (!response.ok) {
      res.json([
        { id: "grok-3", name: "Grok 3", contextLength: 131072 },
        { id: "grok-3-mini", name: "Grok 3 Mini", contextLength: 131072 },
        { id: "grok-2", name: "Grok 2", contextLength: 131072 },
      ]);
      return;
    }
    const data = (await response.json()) as {
      models?: Array<{
        id: string;
        name?: string;
        context_length?: number;
        description?: string;
      }>;
    };
    const models = (data.models ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length ?? 131072,
    }));
    res.json(models);
  } catch {
    res.json([
      { id: "grok-3", name: "Grok 3", contextLength: 131072 },
      { id: "grok-3-mini", name: "Grok 3 Mini", contextLength: 131072 },
    ]);
  }
});

export default router;
