import { createStudioFeasibilityBridgeServer } from "./studio-feasibility-bridge.js";
import { parsePort } from "./server.js";

const port = parsePort(process.env.STUDIO_FEASIBILITY_BRIDGE_PORT ?? "4318");
const { bridge, server } = createStudioFeasibilityBridgeServer(port);

server.listen(port, "127.0.0.1", () => {
  // The activation contains an ephemeral secret. It is shown only in the local terminal for an
  // explicit one-time paste into the development plugin and is never written to disk.
  console.log(JSON.stringify(bridge.activation));
});
