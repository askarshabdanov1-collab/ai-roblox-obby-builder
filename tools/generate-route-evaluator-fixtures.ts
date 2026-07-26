import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  expectedRouteEvaluatorFixture,
  routeEvaluatorFixturePath,
} from "./route-evaluator-fixture-content.js";

await mkdir(dirname(routeEvaluatorFixturePath), { recursive: true });
await writeFile(
  routeEvaluatorFixturePath,
  expectedRouteEvaluatorFixture(),
  "utf8",
);
console.log(`generated ${routeEvaluatorFixturePath}`);
