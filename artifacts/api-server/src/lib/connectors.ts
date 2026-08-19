/**
 * Portable API proxy helpers.
 *
 * Inside Replit the @replit/connectors-sdk injects credentials automatically.
 * Outside Replit the helpers fall back to standard environment variables so
 * the server runs identically on any Linux machine, Docker container, or CI
 * system.
 */

const isReplit = Boolean(process.env["REPL_ID"]);

/**
 * Proxy a request to the xAI (Grok) API.
 *
 * Replit:         auth injected by @replit/connectors-sdk
 * Standalone:     reads XAI_API_KEY — obtain at https://console.x.ai
 */
export async function xaiProxy(
  apiPath: string,
  init?: RequestInit,
): Promise<Response> {
  if (isReplit) {
    const { ReplitConnectors } = await import("@replit/connectors-sdk");
    const connectors = new ReplitConnectors();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return connectors.proxy("xai", apiPath, init as any) as Promise<Response>;
  }

  const apiKey = process.env["XAI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "XAI_API_KEY is required when running outside Replit. " +
        "Get your key at https://console.x.ai and set it in .env.",
    );
  }

  const headers = {
    ...(init?.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${apiKey}`,
  };
  return fetch(`https://api.x.ai${apiPath}`, { ...init, headers });
}

/**
 * Proxy a request to the GitHub REST API.
 *
 * Replit:         auth injected by @replit/connectors-sdk
 * Standalone:     reads GITHUB_TOKEN — create a fine-grained PAT at
 *                 https://github.com/settings/tokens with repo/contents write
 */
export async function githubProxy(
  apiPath: string,
  init?: RequestInit,
): Promise<Response> {
  if (isReplit) {
    const { ReplitConnectors } = await import("@replit/connectors-sdk");
    const connectors = new ReplitConnectors();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return connectors.proxy("github", apiPath, init as any) as Promise<Response>;
  }

  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is required when running outside Replit. " +
        "Create a PAT at https://github.com/settings/tokens and set it in .env.",
    );
  }

  const headers = {
    ...(init?.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  return fetch(`https://api.github.com${apiPath}`, { ...init, headers });
}
