import { createServer } from "node:http";

const port = Number.parseInt(process.env.ORCHESTRATOR_PORT ?? "4317", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid ORCHESTRATOR_PORT");

createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "ai-roblox-obby-orchestrator", version: "0.1.0" }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: false, error: "NOT_FOUND" }));
}).listen(port, "127.0.0.1", () => {
  console.log(`Orchestrator listening on http://127.0.0.1:${port}`);
});
