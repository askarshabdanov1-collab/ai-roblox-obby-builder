#!/usr/bin/env node
import { runGeneratorCli } from "./index.js";

process.exitCode = await runGeneratorCli(process.argv.slice(2));
