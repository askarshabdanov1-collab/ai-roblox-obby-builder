import { createServer, type Server } from "node:http";

export const SERVICE_NAME = "ai-roblox-obby-orchestrator";
export const SERVICE_VERSION = "0.2.0";

export function parsePort(value: string | undefined): number {
  const port = Number.parseInt(value ?? "4317", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("ORCHESTRATOR_PORT must be an integer from 1 to 65535");
  }
  return port;
}

export function createOrchestratorServer(): Server {
  return createServer((request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("x-content-type-options", "nosniff");

    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200);
      response.end(
        JSON.stringify({
          ok: true,
          service: SERVICE_NAME,
          version: SERVICE_VERSION,
        }),
      );
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ ok: false, error: "NOT_FOUND" }));
  });
}
