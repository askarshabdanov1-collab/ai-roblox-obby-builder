import { afterEach, describe, expect, it } from "vitest";

import { createOrchestratorServer, parsePort } from "../src/server.js";

const servers: ReturnType<typeof createOrchestratorServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
});

describe("orchestrator", () => {
  it("validates the configured port", () => {
    expect(parsePort(undefined)).toBe(4317);
    expect(parsePort(" 4317 ")).toBe(4317);
    expect(parsePort("65535")).toBe(65_535);
    for (const invalid of [
      "",
      " ",
      "+4317",
      "-4317",
      "43.17",
      "0x10",
      "4317junk",
      "43 17",
      "0",
      "65536",
    ]) {
      expect(() => parsePort(invalid), invalid).toThrow(
        "ORCHESTRATOR_PORT must be an integer from 1 to 65535",
      );
    }
  });

  it("serves health and fails closed for unknown routes", async () => {
    const server = createOrchestratorServer();
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Expected a TCP address");

    const health = await fetch(`http://127.0.0.1:${address.port}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      ok: true,
      service: "ai-roblox-obby-orchestrator",
      version: "0.2.0",
    });
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");

    const missing = await fetch(`http://127.0.0.1:${address.port}/missing`);
    expect(missing.status).toBe(404);
  });
});
