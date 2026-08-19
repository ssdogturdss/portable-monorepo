import { Router } from "express";
import { githubProxy } from "../lib/connectors";
import { logger } from "../lib/logger";

const router = Router();

// GET /github/user — authenticated GitHub user
router.get("/github/user", async (_req, res) => {
  try {
    const response = await githubProxy("/user");
    if (!response.ok) {
      res.status(response.status).json({ error: "GitHub request failed" });
      return;
    }
    const data = (await response.json()) as {
      login: string;
      name: string | null;
      avatar_url: string;
    };
    res.json({ login: data.login, name: data.name, avatarUrl: data.avatar_url });
  } catch (err) {
    logger.error({ err }, "GitHub user error");
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

// GET /github/repos — list repos the token can access
router.get("/github/repos", async (_req, res) => {
  try {
    const response = await githubProxy(
      "/user/repos?sort=pushed&per_page=50&affiliation=owner,collaborator",
    );
    if (!response.ok) {
      res.status(response.status).json({ error: "GitHub request failed" });
      return;
    }
    const repos = (await response.json()) as Array<{
      full_name: string;
      name: string;
      private: boolean;
      default_branch: string;
      description: string | null;
    }>;
    res.json(
      repos.map((r) => ({
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        defaultBranch: r.default_branch,
        description: r.description,
      })),
    );
  } catch (err) {
    logger.error({ err }, "GitHub repos error");
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

// GET /github/repos/:owner/:repo/branches
router.get("/github/repos/:owner/:repo/branches", async (req, res) => {
  const { owner, repo } = req.params;
  try {
    const response = await githubProxy(
      `/repos/${owner}/${repo}/branches?per_page=50`,
    );
    if (!response.ok) {
      res.status(response.status).json({ error: "GitHub request failed" });
      return;
    }
    const branches = (await response.json()) as Array<{ name: string }>;
    res.json(branches.map((b) => b.name));
  } catch (err) {
    logger.error({ err }, "GitHub branches error");
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

// POST /github/push — create or update a file in a repo
router.post("/github/push", async (req, res) => {
  const { owner, repo, branch, path, message, content } = req.body as {
    owner: string;
    repo: string;
    branch: string;
    path: string;
    message: string;
    content: string;
  };

  if (!owner || !repo || !branch || !path || !message || content === undefined) {
    res.status(400).json({ error: "Missing required fields: owner, repo, branch, path, message, content" });
    return;
  }

  const safePath = path.replace(/^\/+/, "");

  try {
    // Check if file already exists to get its SHA (needed for updates)
    let existingSha: string | undefined;
    const existingRes = await githubProxy(
      `/repos/${owner}/${repo}/contents/${safePath}?ref=${branch}`,
    );
    if (existingRes.ok) {
      const existing = (await existingRes.json()) as { sha: string };
      existingSha = existing.sha;
    }

    // Create or update the file
    const b64 = Buffer.from(content, "utf-8").toString("base64");
    const body: Record<string, unknown> = { message, content: b64, branch };
    if (existingSha) body.sha = existingSha;

    const pushRes = await githubProxy(
      `/repos/${owner}/${repo}/contents/${safePath}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!pushRes.ok) {
      const errText = await pushRes.text();
      logger.error({ errText, status: pushRes.status }, "GitHub push failed");
      res.status(pushRes.status).json({ error: "GitHub push failed", detail: errText });
      return;
    }

    const result = (await pushRes.json()) as {
      content: { html_url: string; path: string };
      commit: { sha: string; html_url: string };
    };

    res.json({
      fileUrl: result.content?.html_url,
      commitUrl: result.commit?.html_url,
      commitSha: result.commit?.sha,
      path: result.content?.path,
    });
  } catch (err) {
    logger.error({ err }, "GitHub push error");
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

export default router;
