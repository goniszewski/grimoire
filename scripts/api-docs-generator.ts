import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type {
  ApiContract,
  ApiObjectSchema,
  ApiRoute,
  ApiSchema,
  ApiSchemaMap,
  HttpMethod,
} from "../daemon/src/api/schema";

export interface ApiContractDocument<Schemas extends ApiSchemaMap = ApiSchemaMap> {
  schemaVersion: 1;
  name: string;
  version: string;
  baseUrl: string;
  description: string;
  schemas: Schemas;
  routes: ApiRoute[];
}

export interface RouteImplementationDrift {
  missingFromContract: string[];
  extraInContract: string[];
}

export interface ApiDocOutputs {
  markdown: string;
  contractJson: string;
}

export interface ApiDocOutputPaths {
  markdown: string;
  contractJson: string;
}

interface FieldRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all"]);

export function buildApiContractDocument<const Contract extends ApiContract>(
  contract: Contract
): ApiContractDocument<Contract["schemas"]> {
  return {
    schemaVersion: 1,
    name: contract.name,
    version: contract.version,
    baseUrl: contract.baseUrl,
    description: contract.description,
    schemas: contract.schemas,
    routes: [...contract.routes],
  };
}

export function buildApiDocOutputs(contract: ApiContract): ApiDocOutputs {
  const document = buildApiContractDocument(contract);
  return {
    markdown: buildApiMarkdown(document),
    contractJson: `${JSON.stringify(document, null, 2)}\n`,
  };
}

export function writeApiDocOutputs(outputs: ApiDocOutputs, paths: ApiDocOutputPaths): void {
  writeFileSync(paths.markdown, outputs.markdown);
  writeFileSync(paths.contractJson, outputs.contractJson);
}

export function findApiDocDrift(outputs: ApiDocOutputs, paths: ApiDocOutputPaths): string[] {
  const drift: string[] = [];
  if (!existsSync(paths.markdown) || readFileSync(paths.markdown, "utf8") !== outputs.markdown) {
    drift.push(paths.markdown);
  }
  if (!existsSync(paths.contractJson) || readFileSync(paths.contractJson, "utf8") !== outputs.contractJson) {
    drift.push(paths.contractJson);
  }
  return drift;
}

export function findRouteImplementationDrift(
  contract: Pick<ApiContract, "routes">,
  routesDir: string
): RouteImplementationDrift {
  const implemented = new Set(extractImplementedRoutes(routesDir));
  const declared = new Set(contract.routes.map(routeKey));

  return {
    missingFromContract: [...implemented].filter((key) => !declared.has(key)).sort(),
    extraInContract: [...declared].filter((key) => !implemented.has(key)).sort(),
  };
}

export function buildApiMarkdown(document: ApiContractDocument): string {
  const lines: string[] = [];
  lines.push("# Little Imp API Documentation");
  lines.push("");
  lines.push("> Auto-generated from `daemon/src/api/contract.ts`. Do not edit by hand.");
  lines.push("");
  lines.push("## Contract");
  lines.push("");
  lines.push(`- Base URL: \`${document.baseUrl}\``);
  lines.push("- Machine-readable contract: [`docs/api-contract.json`](./docs/api-contract.json)");
  lines.push("- Regenerate: `npm run docs:api`");
  lines.push("- Drift check: `npm run docs:api:check`");
  lines.push("");
  lines.push("## Authentication");
  lines.push("");
  lines.push("The daemon is intended to bind to localhost. The first-party loopback browser app uses the local origin boundary and does not need to send an API token.");
  lines.push("");
  lines.push("Local integration surfaces such as `/mcp` require a managed bearer token. Create one with `POST /integration-tokens`, store the returned token immediately, and send it as `Authorization: Bearer <token>`. Regular REST routes remain tokenless for the first-party app, but if a client presents an `Authorization` header it must be a valid integration token. List responses only include redacted token prefixes. Missing required tokens, invalid tokens, rotated tokens, or revoked tokens return `401` with `application/problem+json` and a `WWW-Authenticate` bearer challenge.");
  lines.push("");
  lines.push("## Response Conventions");
  lines.push("");
  lines.push("- Most JSON endpoints return `{ \"data\": ... }` envelopes.");
  lines.push("- Paginated endpoints include a `pagination` object with `total`, `limit`, `offset`, and `has_more`.");
  lines.push("- Newer route validation errors use `application/problem+json`; some backup/export routes still return `{ \"error\": string }`.");
  lines.push("");
  lines.push("## Endpoints");
  lines.push("");

  for (const [tag, routes] of groupRoutesByTag(document.routes)) {
    lines.push(`### ${tag}`);
    lines.push("");
    for (const route of routes) {
      lines.push(`#### ${route.method} ${route.path}`);
      lines.push("");
      lines.push(route.summary);
      lines.push("");
      if (route.description) {
        lines.push(route.description);
        lines.push("");
      }
      appendRequest(lines, route, document.schemas);
      appendResponses(lines, route, document.schemas);
      appendExamples(lines, route);
    }
  }

  lines.push("## Schemas");
  lines.push("");
  for (const [name, schema] of Object.entries(document.schemas)) {
    lines.push(`### ${name}`);
    lines.push("");
    if (schema.description) {
      lines.push(schema.description);
      lines.push("");
    }
    const fields = flattenSchemaFields(schema, document.schemas);
    if (fields.length === 0) {
      lines.push(`Type: \`${schemaTypeLabel(schema, document.schemas)}\``);
      lines.push("");
      continue;
    }
    appendFieldTable(lines, fields);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function groupRoutesByTag(routes: ApiRoute[]): Array<[string, ApiRoute[]]> {
  const grouped = new Map<string, ApiRoute[]>();
  for (const route of routes) {
    grouped.set(route.tag, [...(grouped.get(route.tag) ?? []), route]);
  }
  return [...grouped.entries()];
}

function appendRequest(lines: string[], route: ApiRoute, schemas: ApiSchemaMap): void {
  if (!route.request) return;

  const { pathParams, query, body } = route.request;
  if (pathParams) {
    lines.push("Path parameters:");
    lines.push("");
    appendFieldTable(lines, flattenSchemaFields(pathParams, schemas, "", false));
  }
  if (query) {
    lines.push("Query parameters:");
    lines.push("");
    appendFieldTable(lines, flattenSchemaFields(query, schemas, "", false));
  }
  if (body) {
    lines.push("Request body:");
    lines.push("");
    lines.push(`- Content type: \`${body.contentType}\``);
    if (body.description) lines.push(`- ${body.description}`);
    lines.push(`- Schema: \`${schemaTypeLabel(body.schema, schemas)}\``);
    const fields = flattenSchemaFields(body.schema, schemas);
    if (fields.length > 0) {
      lines.push("");
      appendFieldTable(lines, fields);
    } else {
      lines.push("");
    }
  }
}

function appendResponses(lines: string[], route: ApiRoute, schemas: ApiSchemaMap): void {
  lines.push("Responses:");
  lines.push("");
  lines.push("| Status | Content type | Schema | Description |");
  lines.push("|---|---|---|---|");
  for (const [status, response] of Object.entries(route.responses)) {
    lines.push(
      `| \`${status}\` | ${escapeTable(response.contentType ?? "-")} | ${escapeTable(
        response.schema ? `\`${schemaTypeLabel(response.schema, schemas)}\`` : "-"
      )} | ${escapeTable(response.description)} |`
    );
  }
  lines.push("");
}

function appendExamples(lines: string[], route: ApiRoute): void {
  if (!route.examples || route.examples.length === 0) return;

  lines.push("Examples:");
  lines.push("");
  for (const example of route.examples) {
    lines.push(`**${example.title}**`);
    lines.push("");
    lines.push("```bash");
    lines.push(example.request);
    lines.push("```");
    lines.push("");
  }
}

function appendFieldTable(lines: string[], fields: FieldRow[]): void {
  lines.push("| Field | Type | Required | Description |");
  lines.push("|---|---|---:|---|");
  for (const field of fields) {
    lines.push(
      `| \`${field.name}\` | ${escapeTable(field.type)} | ${field.required ? "yes" : "no"} | ${escapeTable(
        field.description
      )} |`
    );
  }
  lines.push("");
}

function flattenSchemaFields(
  schema: ApiSchema,
  schemas: ApiSchemaMap,
  prefix = "",
  deep = true,
  seen = new Set<string>()
): FieldRow[] {
  const resolved = resolveSchema(schema, schemas);
  if (!resolved || !("type" in resolved) || resolved.type !== "object") return [];

  const required = new Set(resolved.required ?? []);
  const fields: FieldRow[] = [];
  for (const [name, child] of Object.entries(resolved.properties)) {
    const fieldName = prefix ? `${prefix}.${name}` : name;
    fields.push({
      name: fieldName,
      type: schemaTypeLabel(child, schemas),
      required: required.has(name),
      description: child.description ?? "",
    });

    const childResolved = resolveSchema(child, schemas);
    if (
      deep &&
      childResolved &&
      "type" in childResolved &&
      childResolved.type === "object" &&
      !seen.has(fieldName)
    ) {
      seen.add(fieldName);
      fields.push(...flattenSchemaFields(childResolved, schemas, fieldName, deep, seen));
    }
  }
  return fields;
}

function schemaTypeLabel(schema: ApiSchema, schemas: ApiSchemaMap): string {
  if ("ref" in schema) return nullableTypeLabel(schema, schema.ref);
  if ("oneOf" in schema) {
    return nullableTypeLabel(schema, schema.oneOf.map((item) => schemaTypeLabel(item, schemas)).join(" | "));
  }
  if ("enum" in schema && schema.enum) {
    return nullableTypeLabel(schema, schema.enum.map((item) => JSON.stringify(item)).join(" | "));
  }
  if ("type" in schema && schema.type === "array") {
    return nullableTypeLabel(schema, `array<${schemaTypeLabel(schema.items, schemas)}>`);
  }
  if ("type" in schema) {
    return nullableTypeLabel(schema, schema.type);
  }
  return "unknown";
}

function nullableTypeLabel(schema: ApiSchema, label: string): string {
  return schema.nullable ? `${label} | null` : label;
}

function resolveSchema(schema: ApiSchema, schemas: ApiSchemaMap): ApiSchema | null {
  if ("ref" in schema) return schemas[schema.ref] ?? null;
  return schema;
}

function routeKey(route: Pick<ApiRoute, "method" | "path">): string {
  return `${route.method} ${route.path}`;
}

function extractImplementedRoutes(routesDir: string): string[] {
  const files = getTypeScriptFiles(routesDir);
  const routes = new Set<string>();
  const routePattern = /\b(?:router|app)\.(get|post|put|patch|delete|all)\s*\(\s*["'`]([^"'`]+)["'`]/g;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = routePattern.exec(content)) !== null) {
      const [, rawMethod, path] = match;
      if (!HTTP_METHODS.has(rawMethod)) continue;
      routes.add(`${rawMethod.toUpperCase() as HttpMethod} ${path}`);
    }
  }

  return [...routes].sort();
}

function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getTypeScriptFiles(fullPath));
    } else if (extname(entry) === ".ts") {
      files.push(fullPath);
    }
  }
  return files;
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
