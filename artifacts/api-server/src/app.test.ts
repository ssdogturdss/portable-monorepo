import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// Mock @workspace/db so the server can be imported without DATABASE_URL set.
// The mock returns a Drizzle-shaped fluent API that tests can inspect or
// override via vi.mocked().
// ---------------------------------------------------------------------------

const mockNote = {
  id: 1,
  title: "Hello world",
  body: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

// Helper: returns an object that is both awaitable (Promise-like) and has a
// .where() method — mirrors Drizzle's select().from() builder.
function makeSelectFromResult(rows: unknown[]) {
  return {
    where: vi.fn().mockResolvedValue(rows),
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(rows).then(res, rej),
  };
}

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => makeSelectFromResult([mockNote])),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([mockNote]),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([mockNote]),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([mockNote]),
    })),
  })),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  notesTable: {},
}));

// Import app after the mock is registered
const { default: app } = await import("./app");

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("API server", () => {
  it("responds 200 with ok status on /api/healthz", async () => {
    const res = await fetch(`${baseUrl}/api/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok" });
  });

  it("returns 404 for unknown API routes", async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/notes", () => {
  it("returns 200 with an array of notes", async () => {
    const res = await fetch(`${baseUrl}/api/notes`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({ id: 1, title: "Hello world" });
  });
});

describe("POST /api/notes", () => {
  it("creates a note and returns 201", async () => {
    const res = await fetch(`${baseUrl}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello world" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: 1, title: "Hello world" });
  });

  it("returns 422 when title is missing", async () => {
    const res = await fetch(`${baseUrl}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "No title here" }),
    });
    expect(res.status).toBe(422);
  });
});

describe("GET /api/notes/:id", () => {
  it("returns 200 with the note when found", async () => {
    const res = await fetch(`${baseUrl}/api/notes/1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: 1, title: "Hello world" });
  });

  it("returns 404 when the note does not exist", async () => {
    // Override the where() mock to return an empty array for this test
    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
        then: (res: (v: unknown) => void, rej: (e: unknown) => void) =>
          Promise.resolve([]).then(res, rej),
      })),
    }));
    const res = await fetch(`${baseUrl}/api/notes/999`);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/notes/:id", () => {
  it("updates a note and returns 200", async () => {
    const res = await fetch(`${baseUrl}/api/notes/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated title" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: 1 });
  });

  it("returns 404 when the note does not exist", async () => {
    mockDb.update.mockImplementationOnce(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    }));
    const res = await fetch(`${baseUrl}/api/notes/999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/notes/:id", () => {
  it("deletes a note and returns 204", async () => {
    const res = await fetch(`${baseUrl}/api/notes/1`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("returns 404 when the note does not exist", async () => {
    mockDb.delete.mockImplementationOnce(() => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    }));
    const res = await fetch(`${baseUrl}/api/notes/999`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
