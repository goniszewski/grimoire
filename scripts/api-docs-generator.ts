import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type {
  ApiContract,
  ApiExampleBody,
  ApiExampleResponse,
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

export interface RouteStatusCodeMismatch {
  route: string;
  file: string;
  daemonCodes: number[];
  contractCodes: number[];
  missingFromContract: number[];
  missingFromDaemon: number[];
}

export interface RouteStatusCodeDrift {
  mismatches: RouteStatusCodeMismatch[];
}

export interface ApiDocOutputs {
  markdown: string;
  contractJson: string;
  openApiJson: string;
}

export interface ApiDocOutputPaths {
  markdown: string;
  contractJson: string;
  openApiJson: string;
}

type ApiDocOutputKind = keyof ApiDocOutputs;

interface OpenApiDocument {
  openapi: "3.0.3";
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  tags: Array<{ name: string }>;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, OpenApiSchema>;
    securitySchemes: Record<string, OpenApiSecurityScheme>;
  };
  "x-little-imp-contract": {
    schemaVersion: ApiContractDocument["schemaVersion"];
    source: string;
  };
}

type OpenApiSchema = Record<string, unknown>;

interface OpenApiSecurityScheme {
  type: "http";
  scheme: "bearer";
  bearerFormat: string;
  description: string;
}

interface OpenApiOperation {
  tags: string[];
  summary: string;
  description?: string;
  operationId: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
  security?: Array<Record<string, string[]>>;
  "x-little-imp-source-method": HttpMethod;
}

interface OpenApiParameter {
  name: string;
  in: "path" | "query";
  required: boolean;
  description?: string;
  schema: OpenApiSchema;
}

interface OpenApiRequestBody {
  description?: string;
  content: Record<string, { schema: OpenApiSchema }>;
}

interface OpenApiResponse {
  description: string;
  content?: Record<string, { schema: OpenApiSchema }>;
}

interface FieldRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all"]);
const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
  502: "Bad Gateway",
};

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
  const openApiDocument = buildOpenApiDocument(contract);
  return {
    markdown: buildApiMarkdown(document),
    contractJson: `${JSON.stringify(document, null, 2)}\n`,
    openApiJson: `${JSON.stringify(openApiDocument, null, 2)}\n`,
  };
}

export function writeApiDocOutputs(
  outputs: ApiDocOutputs,
  paths: ApiDocOutputPaths,
  kinds: readonly ApiDocOutputKind[] = ["markdown", "contractJson", "openApiJson"]
): void {
  for (const kind of kinds) {
    writeFileSync(paths[kind], outputs[kind]);
  }
}

export function findApiDocDrift(
  outputs: ApiDocOutputs,
  paths: ApiDocOutputPaths,
  kinds: readonly ApiDocOutputKind[] = ["markdown", "contractJson", "openApiJson"]
): string[] {
  const drift: string[] = [];
  for (const kind of kinds) {
    if (!existsSync(paths[kind]) || readFileSync(paths[kind], "utf8") !== outputs[kind]) {
      drift.push(paths[kind]);
    }
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

export function findRouteStatusCodeDrift(
  contract: Pick<ApiContract, "routes">,
  routesDir: string
): RouteStatusCodeDrift {
  const contractStatusCodes = new Map<string, Set<number>>();
  for (const route of contract.routes) {
    const codes = new Set(
      Object.keys(route.responses)
        .map(Number)
        .filter((n) => !isNaN(n))
    );
    contractStatusCodes.set(routeKey(route), codes);
  }

  const daemonStatusCodes = extractRouteStatusCodes(routesDir);
  const mismatches: RouteStatusCodeMismatch[] = [];

  for (const [route, daemonInfo] of daemonStatusCodes) {
    const contractCodes = contractStatusCodes.get(route) ?? new Set<number>();
    const daemonCodes = daemonInfo.codes;

    const missingFromContract = [...daemonCodes]
      .filter((c) => !contractCodes.has(c))
      .sort((a, b) => a - b);
    const missingFromDaemon = [...contractCodes]
      .filter((c) => !daemonCodes.has(c) && !MIDDLEWARE_STATUS_CODES.has(c))
      .sort((a, b) => a - b);

    if (missingFromContract.length > 0 || missingFromDaemon.length > 0) {
      mismatches.push({
        route,
        file: daemonInfo.file,
        daemonCodes: [...daemonCodes].sort((a, b) => a - b),
        contractCodes: [...contractCodes].sort((a, b) => a - b),
        missingFromContract,
        missingFromDaemon,
      });
    }
  }

  return { mismatches };
}

function extractRouteStatusCodes(
  routesDir: string
): Map<string, { file: string; codes: Set<number> }> {
  const files = getTypeScriptFiles(routesDir);
  const result = new Map<string, { file: string; codes: Set<number> }>();
  const routeDefPattern =
    /\b(router|app)\.(get|post|put|patch|delete|all)\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*/g;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = routeDefPattern.exec(content)) !== null) {
      const [, , rawMethod, path] = match;
      if (!HTTP_METHODS.has(rawMethod)) continue;

      const route = `${rawMethod.toUpperCase() as HttpMethod} ${path}`;
      const handlerBody = extractHandlerBody(content, match.index + match[0].length);
      const codes = handlerBody ? extractStatusCodes(handlerBody) : new Set([200]);

      result.set(route, { file, codes });
    }
  }

  return result;
}

function extractHandlerBody(
  content: string,
  startPos: number
): string | null {
  let i = startPos;
  while (i < content.length && content[i] !== "{") i++;
  if (i >= content.length) return null;

  let depth = 1;
  const bodyStart = i;
  i++;
  while (i < content.length && depth > 0) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") depth--;
    i++;
  }

  return depth === 0 ? content.slice(bodyStart, i) : null;
}

function extractStatusCodes(body: string): Set<number> {
  const codes = new Set<number>();

  const patterns: Array<{ regex: RegExp; group: number }> = [
    { regex: /problem\s*\(\s*c\s*,\s*(\d{3})\s*,/g, group: 1 },
    { regex: /ok\s*\(\s*c\s*,\s*[^,)]+,\s*(\d{3})\s*\)/g, group: 1 },
    { regex: /c\s*\.\s*json\s*\([^)]*,\s*(\d{3})\s*\)/g, group: 1 },
    { regex: /c\s*\.\s*body\s*\(\s*null\s*,\s*(\d{3})\s*\)/g, group: 1 },
  ];

  const explicitJsonStatusPattern = /c\s*\.\s*json\s*\([^)]*,\s*(\d{3})\s*\)/g;
  let explicitJsonCount = 0;
  for (const { regex, group } of patterns) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(body)) !== null) {
      codes.add(parseInt(m[group], 10));
    }
  }
  // Count c.json(..., NNN) matches separately
  {
    const re = new RegExp(explicitJsonStatusPattern.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      explicitJsonCount++;
    }
  }

  // Detect c.json() calls without explicit status → implies 200.
  // Count all c.json( occurrences and compare with explicit-status count.
  const allJsonCalls = (body.match(/c\s*\.\s*json\s*\(/g) ?? []).length;
  if (allJsonCalls > explicitJsonCount) {
    codes.add(200);
  }

  // Fallback: if no status codes detected at all, assume 200
  if (codes.size === 0) {
    codes.add(200);
  }

  return codes;
}

/**
 * Status codes injected by server-wide middleware (body limits, auth, CORS, etc.).
 * These are not visible in per-route handler bodies and should be excluded from
 * the "contract declares but daemon is missing" comparison.
 */
const MIDDLEWARE_STATUS_CODES = new Set([401, 413, 415]);

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
  lines.push("- OpenAPI output: [`docs/openapi.json`](./docs/openapi.json)");
  lines.push("- Regenerate: `npm run docs:api`");
  lines.push("- Drift check: `npm run docs:api:check`");
  lines.push("- OpenAPI-only commands: `npm run docs:openapi` and `npm run docs:openapi:check`");
  lines.push("");
  lines.push("## Authentication");
  lines.push("");
  lines.push("The daemon is intended to bind to localhost. The first-party loopback browser app uses the local origin boundary and does not need to send an API token.");
  lines.push("");
  lines.push("Local integration surfaces such as `/mcp` and `/capture` require a managed bearer token. Create one with `POST /integration-tokens`, store the returned token immediately, and send it as `Authorization: Bearer <token>`. Regular REST routes remain tokenless for the first-party app, but if a client presents an `Authorization` header it must be a valid integration token. List responses only include redacted token prefixes. Missing required tokens, invalid tokens, rotated tokens, or revoked tokens return `401` with `application/problem+json` and a `WWW-Authenticate` bearer challenge.");
  lines.push("");
  lines.push("## Browser Origin And CORS");
  lines.push("");
  lines.push("Little Imp keeps browser access loopback-only. The daemon trusts the first-party app from `http://127.0.0.1:3210`, `http://localhost:3210`, and configured loopback development origins. Requests without an `Origin` header are treated as non-browser local client traffic and do not receive CORS headers.");
  lines.push("");
  lines.push("Configure additional local browser clients with `CORS_ORIGINS` as a comma-separated list of loopback origins:");
  lines.push("");
  lines.push("```sh");
  lines.push("CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4321 littleimpd");
  lines.push("```");
  lines.push("");
  lines.push("Only full `http` or `https` origins are accepted, including scheme, host, and any port used by the client. Non-loopback origins are ignored even when configured, unsafe browser writes from rejected origins return `403`, and rejected preflight requests return `403` without reflecting `Access-Control-Allow-Origin`. Protected local capture clients must use loopback origins and a managed integration bearer token.");
  lines.push("");
  lines.push("## Response Conventions");
  lines.push("");
  lines.push("- Most JSON endpoints return `{ \"data\": ... }` envelopes.");
  lines.push("- Paginated endpoints include a `pagination` object with `total`, `limit`, `offset`, and `has_more`.");
  lines.push("- Newer route validation errors use `application/problem+json`; some backup/export routes still return `{ \"error\": string }`.");
  lines.push("");
  lines.push("## OpenAPI Output");
  lines.push("");
  lines.push("`docs/openapi.json` is generated from the same daemon-owned contract for local client tooling that expects an OpenAPI 3.0 document.");
  lines.push("");
  lines.push("Limitations:");
  lines.push("");
  lines.push("- Hono `ALL` routes are represented by the primary client method `POST` with `x-little-imp-source-method: \"ALL\"`.");
  lines.push("- Mixed content responses such as JSON/CSV exports share the closest generated schema; CSV, media, and SSE clients should still use the documented content type.");
  lines.push("- First-party REST routes remain local-origin routes. The OpenAPI bearer scheme documents managed local integration tokens, and MCP marks that scheme as required.");
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

export function buildOpenApiDocument(contract: ApiContract): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};

  for (const route of contract.routes) {
    const openApiPath = toOpenApiPath(route.path);
    const pathItem = paths[openApiPath] ?? {};
    paths[openApiPath] = pathItem;

    for (const method of toOpenApiMethods(route.method)) {
      pathItem[method] = buildOpenApiOperation(route, method, contract.schemas);
    }
  }

  return {
    openapi: "3.0.3",
    info: {
      title: contract.name,
      version: contract.version,
      description: contract.description,
    },
    servers: [{ url: contract.baseUrl }],
    tags: [...new Set(contract.routes.map((route) => route.tag))].map((name) => ({ name })),
    paths,
    components: {
      schemas: Object.fromEntries(
        Object.entries(contract.schemas).map(([name, schema]) => [name, toOpenApiSchema(schema)])
      ),
      securitySchemes: {
        localIntegrationBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Little Imp integration token",
          description: "Managed local integration bearer token created with POST /integration-tokens.",
        },
      },
    },
    "x-little-imp-contract": {
      schemaVersion: 1,
      source: "daemon/src/api/contract.ts",
    },
  };
}

function buildOpenApiOperation(
  route: ApiRoute,
  openApiMethod: string,
  schemas: ApiSchemaMap
): OpenApiOperation {
  const parameters = [
    ...openApiParametersFromSchema(route.request?.pathParams, "path", schemas),
    ...openApiParametersFromSchema(route.request?.query, "query", schemas),
  ];
  const operation: OpenApiOperation = {
    tags: [route.tag],
    summary: route.summary,
    ...(route.description ? { description: route.description } : {}),
    operationId: buildOperationId(openApiMethod, route.path),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(route.request?.body ? { requestBody: buildOpenApiRequestBody(route.request.body, schemas) } : {}),
    responses: Object.fromEntries(
      Object.entries(route.responses).map(([status, response]) => [
        status,
        buildOpenApiResponse(response, schemas),
      ])
    ),
    ...(route.path === "/mcp" || route.path === "/capture" ? { security: [{ localIntegrationBearer: [] }] } : {}),
    "x-little-imp-source-method": route.method,
  };

  return operation;
}

function openApiParametersFromSchema(
  schema: ApiObjectSchema | undefined,
  location: "path" | "query",
  schemas: ApiSchemaMap
): OpenApiParameter[] {
  if (!schema) return [];

  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([name, property]) => ({
    name,
    in: location,
    required: location === "path" ? true : required.has(name),
    ...(property.description ? { description: property.description } : {}),
    schema: toOpenApiSchema(property, schemas),
  }));
}

function buildOpenApiRequestBody(
  body: NonNullable<NonNullable<ApiRoute["request"]>["body"]>,
  schemas: ApiSchemaMap
): OpenApiRequestBody {
  return {
    ...(body.description ? { description: body.description } : {}),
    content: buildOpenApiContent(body.contentType, body.schema, schemas),
  };
}

function buildOpenApiResponse(response: ApiResponse, schemas: ApiSchemaMap): OpenApiResponse {
  return {
    description: response.description,
    ...(response.contentType ? { content: buildOpenApiContent(response.contentType, response.schema, schemas) } : {}),
  };
}

function buildOpenApiContent(
  contentType: string,
  schema: ApiSchema | undefined,
  schemas: ApiSchemaMap
): Record<string, { schema: OpenApiSchema }> {
  return Object.fromEntries(
    splitContentTypes(contentType).map((mediaType) => [
      mediaType,
      { schema: openApiSchemaForContentType(mediaType, schema, schemas) },
    ])
  );
}

function openApiSchemaForContentType(
  mediaType: string,
  schema: ApiSchema | undefined,
  schemas: ApiSchemaMap
): OpenApiSchema {
  if (schema && mediaType !== "text/csv") return toOpenApiSchema(schema, schemas);
  if (mediaType.startsWith("image/")) return { type: "string", format: "binary" };
  return { type: "string" };
}

function splitContentTypes(contentType: string): string[] {
  return contentType.split(/\s+or\s+/).map((part) => part.trim()).filter(Boolean);
}

function toOpenApiSchema(schema: ApiSchema, schemas?: ApiSchemaMap): OpenApiSchema {
  if ("ref" in schema) {
    const refSchema = { $ref: `#/components/schemas/${schema.ref}` };
    return schema.nullable ? { allOf: [refSchema], nullable: true } : refSchema;
  }
  if ("oneOf" in schema) {
    return withNullable(schema, { oneOf: schema.oneOf.map((item) => toOpenApiSchema(item, schemas)) });
  }
  if ("type" in schema && schema.type === "array") {
    return withNullable(schema, {
      type: "array",
      ...(schema.description ? { description: schema.description } : {}),
      items: toOpenApiSchema(schema.items, schemas),
    });
  }
  if ("type" in schema && schema.type === "object") {
    const required = schema.required ? [...schema.required] : [];
    return withNullable(schema, {
      type: "object",
      ...(schema.description ? { description: schema.description } : {}),
      properties: Object.fromEntries(
        Object.entries(schema.properties).map(([name, property]) => [name, toOpenApiSchema(property, schemas)])
      ),
      ...(required.length > 0 ? { required } : {}),
      additionalProperties:
        typeof schema.additionalProperties === "object"
          ? toOpenApiSchema(schema.additionalProperties, schemas)
          : (schema.additionalProperties ?? false),
    });
  }
  if ("type" in schema) {
    const converted: OpenApiSchema = {
      type: schema.type,
      ...(schema.description ? { description: schema.description } : {}),
    };
    copySchemaProperty(schema, converted, "enum");
    copySchemaProperty(schema, converted, "example");
    copySchemaProperty(schema, converted, "format");
    copySchemaProperty(schema, converted, "minLength");
    copySchemaProperty(schema, converted, "maxLength");
    copySchemaProperty(schema, converted, "minimum");
    copySchemaProperty(schema, converted, "maximum");
    copySchemaProperty(schema, converted, "pattern");
    return withNullable(schema, converted);
  }
  return {};
}

function copySchemaProperty(schema: ApiSchema, target: OpenApiSchema, property: string): void {
  const record = schema as Record<string, unknown>;
  if (record[property] !== undefined) {
    target[property] = record[property];
  }
}

function withNullable(schema: ApiSchema, converted: OpenApiSchema): OpenApiSchema {
  if (schema.nullable) {
    return { ...converted, nullable: true };
  }
  return converted;
}

function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function toOpenApiMethods(method: HttpMethod): string[] {
  return method === "ALL" ? ["post"] : [method.toLowerCase()];
}

function buildOperationId(method: string, path: string): string {
  const words = [method, ...path.split("/").filter(Boolean).map((segment) => segment.replace(/^:/, ""))];
  return words
    .map((word, index) => {
      const cleaned = word.replace(/[^A-Za-z0-9]+/g, " ");
      const cased = cleaned
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join("");
      if (index === 0) return cased.charAt(0).toLowerCase() + cased.slice(1);
      return cased;
    })
    .join("");
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
    lines.push("Request:");
    lines.push("");
    lines.push("```bash");
    lines.push(example.request);
    lines.push("```");
    lines.push("");
    if (example.response) {
      appendExampleResponse(lines, example.response);
    }
  }
}

function appendExampleResponse(lines: string[], response: ApiExampleResponse): void {
  lines.push("Response:");
  lines.push("");
  lines.push("```http");
  const statusText = response.statusText ?? STATUS_TEXT[response.status] ?? "";
  lines.push(`HTTP/1.1 ${response.status}${statusText ? ` ${statusText}` : ""}`);
  if (response.contentType) {
    lines.push(`Content-Type: ${response.contentType}`);
  }
  for (const [header, value] of Object.entries(response.headers ?? {})) {
    lines.push(`${header}: ${value}`);
  }
  if (response.body !== undefined) {
    lines.push("");
    lines.push(...formatExampleBody(response.body));
  }
  lines.push("```");
  lines.push("");
}

function formatExampleBody(body: ApiExampleBody): string[] {
  if (typeof body === "string") return body.split("\n");
  return JSON.stringify(body, null, 2).split("\n");
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
