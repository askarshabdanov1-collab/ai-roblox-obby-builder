import { readFile } from "node:fs/promises";

import {
  expectedRouteEvaluatorFixture,
  routeEvaluatorFixturePath,
} from "./route-evaluator-fixture-content.js";

const expected = expectedRouteEvaluatorFixture();
const actual = await readFile(routeEvaluatorFixturePath, "utf8").catch(
  () => "",
);
if (actual !== expected) {
  throw new Error(
    `${routeEvaluatorFixturePath} is stale; run npm run evaluator:route:fixtures:generate`,
  );
}
console.log(
  `${routeEvaluatorFixturePath}: deterministic E1b route evidence is current`,
);
