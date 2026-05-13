#!/usr/bin/env bun

import { join } from "node:path";
import { apiContract } from "../daemon/src/api/contract";
import {
  buildApiDocOutputs,
  findApiDocDrift,
  findRouteImplementationDrift,
  writeApiDocOutputs,
  type ApiDocOutputPaths,
} from "./api-docs-generator";

const projectRoot = join(import.meta.dir, "..");
const routesDir = join(projectRoot, "daemon", "src", "routes");
const outputPaths: ApiDocOutputPaths = {
  markdown: join(projectRoot, "API.md"),
  contractJson: join(projectRoot, "docs", "api-contract.json"),
};

const outputs = buildApiDocOutputs(apiContract);
const routeDrift = findRouteImplementationDrift(apiContract, routesDir);

if (routeDrift.missingFromContract.length > 0 || routeDrift.extraInContract.length > 0) {
  console.error("API contract route drift detected.");
  if (routeDrift.missingFromContract.length > 0) {
    console.error("Missing from contract:");
    for (const route of routeDrift.missingFromContract) console.error(`  - ${route}`);
  }
  if (routeDrift.extraInContract.length > 0) {
    console.error("Extra in contract:");
    for (const route of routeDrift.extraInContract) console.error(`  - ${route}`);
  }
  process.exit(1);
}

if (process.argv.includes("--check")) {
  const drift = findApiDocDrift(outputs, outputPaths);
  if (drift.length > 0) {
    console.error("Generated API documentation is stale:");
    for (const file of drift) console.error(`  - ${file}`);
    console.error("Run `npm run docs:api` to regenerate.");
    process.exit(1);
  }
  console.log("API documentation is up to date.");
} else {
  writeApiDocOutputs(outputs, outputPaths);
  console.log(`Generated ${outputPaths.markdown}`);
  console.log(`Generated ${outputPaths.contractJson}`);
}
