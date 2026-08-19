import { Router } from "express";
import { xaiProxy } from "../lib/connectors";

const router = Router();

const FALLBACK_MODELS = [
  { id: "grok-3", name: "Grok 3", contextLength: 131072 },
  { id: "grok-3-mini", name: "Grok 3 Mini", contextLength: 131072 },
  { id: "grok-2", name: "Grok 2", contextLength: 131072 },
];

router.get("/ai/models", async (_req, res) => {
  try {
    const response = await xaiProxy("/v1/language-models");
    if (!response.ok) {
      res.json(FALLBACK_MODELS);
      return;
    }
    const data = (await response.json()) as {
      models?: Array<{
        id: string;
        name?: string;
        context_length?: number;
      }>;
    };
    const models = (data.models ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length ?? 131072,
    }));
    res.json(models.length ? models : FALLBACK_MODELS);
  } catch {
    res.json(FALLBACK_MODELS);
  }
});

export default router;
