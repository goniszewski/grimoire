#!/usr/bin/env bun

import { join } from "node:path";
import { apiContract } from "../daemon/src/api/contract";
import {
  buildApiDocOutputs,
  findApiDocDrift,
  findRouteImplementationDrift,
  findRouteStatusCodeDrift,
  writeApiDocOutputs,
  type ApiDocOutputPaths,
} from "./api-docs-generator";

const projectRoot = join(import.meta.dir, "..");
const routesDir = join(projectRoot, "daemon", "src", "routes");
const outputPaths: ApiDocOutputPaths = {
  markdown: join(projectRoot, "API.md"),
  contractJson: join(projectRoot, "docs", "api-contract.json"),
  openApiJson: join(projectRoot, "docs", "openapi.json"),
};
const openApiOnly = process.argv.includes("--openapi-only");
const outputKinds = openApiOnly ? (["openApiJson"] as const) : undefined;

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

const statusDrift = findRouteStatusCodeDrift(apiContract, routesDir);
if (statusDrift.mismatches.length > 0) {
  console.error("API contract status code drift detected (warning — static analysis limitations apply):");
  for (const m of statusDrift.mismatches) {
    console.error(`  ${m.route} (${m.file}):`);
    if (m.missingFromContract.length > 0) {
      console.error(
        `    Daemon returns but contract missing: ${m.missingFromContract.join(", ")}`
      );
    }
    if (m.missingFromDaemon.length > 0) {
      console.error(
        `    Contract declares but daemon missing: ${m.missingFromDaemon.join(", ")}`
      );
    }
  }
  console.error(
    "  Note: regex-based extraction cannot detect computed status codes or codes inside nested parentheses."
  );
}

if (process.argv.includes("--check")) {
  const drift = findApiDocDrift(outputs, outputPaths, outputKinds);
  if (drift.length > 0) {
    console.error("Generated API documentation is stale:");
    for (const file of drift) console.error(`  - ${file}`);
    console.error("Run `npm run docs:api` to regenerate.");
    process.exit(1);
  }
  console.log("API documentation is up to date.");
} else {
  writeApiDocOutputs(outputs, outputPaths, outputKinds);
  for (const file of Object.values(outputPaths)) {
    if (openApiOnly && file !== outputPaths.openApiJson) continue;
    console.log(`Generated ${file}`);
  }
}
