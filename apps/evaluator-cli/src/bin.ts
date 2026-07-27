#!/usr/bin/env node
import { runEvaluatorCli } from "./index.js";

process.exitCode = await runEvaluatorCli(process.argv.slice(2));
