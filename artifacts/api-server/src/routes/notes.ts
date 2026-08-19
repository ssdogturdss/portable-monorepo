import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import {
  CreateNoteBody,
  GetNoteParams,
  UpdateNoteBody,
  UpdateNoteParams,
  DeleteNoteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /notes – list all notes
router.get("/notes", async (_req: Request, res: Response) => {
  const notes = await db.select().from(notesTable);
  res.json(notes);
});

// POST /notes – create a note
router.post("/notes", async (req: Request, res: Response) => {
  const body = CreateNoteBody.parse(req.body);
  const [note] = await db.insert(notesTable).values(body).returning();
  res.status(201).json(note);
});

// GET /notes/:id – get a single note
router.get("/notes/:id", async (req: Request, res: Response) => {
  const { id } = GetNoteParams.parse(req.params);
  const [note] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, id));
  if (!note) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(note);
});

// PATCH /notes/:id – update a note
router.patch("/notes/:id", async (req: Request, res: Response) => {
  const { id } = UpdateNoteParams.parse(req.params);
  const body = UpdateNoteBody.parse(req.body);
  const [note] = await db
    .update(notesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(notesTable.id, id))
    .returning();
  if (!note) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(note);
});

// DELETE /notes/:id – delete a note
router.delete("/notes/:id", async (req: Request, res: Response) => {
  const { id } = DeleteNoteParams.parse(req.params);
  const [note] = await db
    .delete(notesTable)
    .where(eq(notesTable.id, id))
    .returning();
  if (!note) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

export default router;
