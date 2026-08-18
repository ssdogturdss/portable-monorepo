import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv } from "./env";

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const key of ["PORT", "NODE_ENV", "DATABASE_URL", "SESSION_SECRET"]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value;
  }
}

beforeEach(() => setEnv({}));
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("validateEnv", () => {
  it("accepts a minimal valid development config", () => {
    setEnv({ PORT: "3000" });
    expect(validateEnv()).toEqual({ port: 3000, isProduction: false });
  });

  it("rejects a missing PORT", () => {
    setEnv({});
    expect(() => validateEnv()).toThrow(/PORT is missing/);
  });

  it("rejects a non-integer PORT", () => {
    setEnv({ PORT: "1.5" });
    expect(() => validateEnv()).toThrow(/PORT must be an integer/);
  });

  it("requires DATABASE_URL and SESSION_SECRET in production", () => {
    setEnv({ PORT: "3000", NODE_ENV: "production" });
    expect(() => validateEnv()).toThrow(/DATABASE_URL is missing/);
    expect(() => validateEnv()).toThrow(/SESSION_SECRET is missing/);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    setEnv({ PORT: "3000", DATABASE_URL: "mysql://x:y@host/db" });
    expect(() => validateEnv()).toThrow(/postgres/);
  });

  it("rejects a placeholder SESSION_SECRET in production", () => {
    setEnv({
      PORT: "3000",
      NODE_ENV: "production",
      DATABASE_URL: "postgres://a:b@host:5432/db",
      SESSION_SECRET: "replace-me-with-a-random-secret-value",
    });
    expect(() => validateEnv()).toThrow(/placeholder/);
  });

  it("rejects a short SESSION_SECRET in production", () => {
    setEnv({
      PORT: "3000",
      NODE_ENV: "production",
      DATABASE_URL: "postgres://a:b@host:5432/db",
      SESSION_SECRET: "short",
    });
    expect(() => validateEnv()).toThrow(/at least 32 characters/);
  });

  it("accepts a full valid production config", () => {
    setEnv({
      PORT: "8080",
      NODE_ENV: "production",
      DATABASE_URL: "postgres://a:b@host:5432/db",
      SESSION_SECRET: "kJ8mN2pQ7rT4vW9xZ1cF5hL0aB3dE6gY8uI2oS4wQ7e=",
    });
    expect(validateEnv()).toEqual({ port: 8080, isProduction: true });
  });
});
