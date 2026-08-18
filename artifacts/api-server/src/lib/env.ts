/**
 * Environment variable validation.
 *
 * Validates configuration at startup and fails fast with a descriptive
 * message instead of crashing mysteriously later.
 */

interface EnvVarSpec {
  name: string;
  description: string;
  /** When true, the variable is required in every environment. */
  required: boolean;
  /** When true, the variable is additionally required when NODE_ENV=production. */
  requiredInProduction?: boolean;
  validate?: (value: string) => string | null;
}

const SPECS: EnvVarSpec[] = [
  {
    name: "PORT",
    description: "TCP port the API server listens on (e.g. 3000)",
    required: true,
    validate: (value) => {
      const port = Number(value);
      if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        return `must be an integer between 1 and 65535, got "${value}"`;
      }
      return null;
    },
  },
  {
    name: "DATABASE_URL",
    description:
      "PostgreSQL connection string (e.g. postgres://user:pass@host:5432/dbname). Required in production; only needed in development when database features are used.",
    required: false,
    requiredInProduction: true,
    validate: (value) => {
      try {
        const url = new URL(value);
        if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
          return `must be a postgres:// or postgresql:// URL, got protocol "${url.protocol}"`;
        }
      } catch {
        return `is not a valid URL`;
      }
      return null;
    },
  },
  {
    name: "SESSION_SECRET",
    description:
      "Random secret used to sign sessions/tokens. Generate with: openssl rand -base64 32. Required in production.",
    required: false,
    requiredInProduction: true,
    validate: (value) => {
      const looksLikePlaceholder =
        /replace|changeme|change-me|example|placeholder|secret123|password/i.test(
          value,
        );
      if (process.env["NODE_ENV"] === "production") {
        if (value.length < 32) {
          return `must be at least 32 characters in production (generate with: openssl rand -base64 32)`;
        }
        if (looksLikePlaceholder) {
          return `looks like a placeholder value; set a real random secret in production`;
        }
      }
      return null;
    },
  },
];

export interface ValidatedEnv {
  port: number;
  isProduction: boolean;
}

export function validateEnv(): ValidatedEnv {
  const isProduction = process.env["NODE_ENV"] === "production";
  const errors: string[] = [];

  for (const spec of SPECS) {
    const value = process.env[spec.name];
    const isRequired =
      spec.required || (isProduction && spec.requiredInProduction);

    if (!value) {
      if (isRequired) {
        errors.push(`- ${spec.name} is missing. ${spec.description}`);
      }
      continue;
    }

    const problem = spec.validate?.(value);
    if (problem) {
      errors.push(`- ${spec.name} ${problem}. ${spec.description}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors.join("\n")}\n\nSee .env.example at the repository root for documentation of every variable.`,
    );
  }

  return {
    port: Number(process.env["PORT"]),
    isProduction,
  };
}
