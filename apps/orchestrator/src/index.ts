import { createOrchestratorServer, parsePort } from "./server.js";

const port = parsePort(process.env.ORCHESTRATOR_PORT);
const server = createOrchestratorServer();

server.listen(port, "127.0.0.1", () => {
  console.log(`Orchestrator listening on http://127.0.0.1:${port}`);
});
