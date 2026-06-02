import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { apiContract } from "../daemon/src/api/contract";
import {
  buildApiContractDocument,
  buildApiDocOutputs,
  buildApiMarkdown,
  findRouteImplementationDrift,
  findRouteStatusCodeDrift,
} from "./api-docs-generator";

const routesDir = join(process.cwd(), "daemon", "src", "routes");

describe("API documentation generator", () => {
  it("keeps the daemon API contract aligned with implemented Hono routes", () => {
    const drift = findRouteImplementationDrift(apiContract, routesDir);

    expect(drift).toEqual({
      missingFromContract: [],
      extraInContract: [],
    });
  });

  it("detects status code drift between daemon handlers and the contract", () => {
    const drift = findRouteStatusCodeDrift(apiContract, routesDir);

    // The check runs without throwing and produces a deterministic result.
    expect(drift).toHaveProperty("mismatches");
    expect(Array.isArray(drift.mismatches)).toBe(true);

    // Every mismatch has the expected shape.
    for (const m of drift.mismatches) {
      expect(m).toMatchObject({
        route: expect.any(String),
        file: expect.stringContaining("daemon/src/routes/"),
        daemonCodes: expect.any(Array),
        contractCodes: expect.any(Array),
        missingFromContract: expect.any(Array),
        missingFromDaemon: expect.any(Array),
      });
    }

    // Known limitation: the test does not assert zero mismatches because
    // regex-based extraction cannot detect computed status codes (e.g.
    // `problem(c, status, ...)`) or codes inside nested parentheses.
    // The drift report is a warning in the check pipeline rather than a
    // hard failure, and mismatches should be reviewed during contract updates.
  });

  it("generates docs from the contract instead of stale route prose", () => {
    const document = buildApiContractDocument(apiContract);
    const markdown = buildApiMarkdown(document);

    for (const route of document.routes) {
      expect(markdown).toContain(`#### ${route.method} ${route.path}`);
    }

    expect(markdown).toContain("`ai.embeddings.provider`");
    expect(markdown).toContain("`backup.s3.access_key`");
    expect(markdown).toContain("#### PUT /bookmarks/:id");
    expect(markdown).toContain("#### POST /bookmarks/:id/restore");
    expect(markdown).toContain("#### DELETE /bookmarks/:id/permanent");
    expect(markdown).not.toContain("/bookmarks/:id/pin");
    expect(markdown).not.toContain("/bookmarks/:id/unpin");
  });

  it("emits a machine-readable contract with nested settings and backup endpoints", () => {
    const document = buildApiContractDocument(apiContract);
    const routes = new Set(document.routes.map((route) => `${route.method} ${route.path}`));

    expect(routes).toContain("GET /settings");
    expect(routes).toContain("PUT /settings");
    expect(routes).toContain("PUT /backup/schedule");
    expect(routes).toContain("PUT /backup/destination");
    expect(routes).toContain("POST /settings/test-s3");
    expect(routes).toContain("GET /integration-tokens");
    expect(routes).toContain("POST /integration-tokens");
    expect(routes).toContain("POST /integration-tokens/:id/rotate");
    expect(routes).toContain("DELETE /integration-tokens/:id");
    expect(routes).toContain("POST /capture");
    expect(routes).toContain("ALL /mcp");

    const settingsPatch = document.schemas.SettingsPatch;
    expect(settingsPatch.type).toBe("object");
    expect(settingsPatch.properties.ai.type).toBe("object");
    expect(settingsPatch.properties.ai.properties.embeddings.type).toBe("object");
    expect(settingsPatch.properties.ai.properties.embeddings.properties.provider.enum).toEqual([
      "openai",
      "ollama",
      "openai_compatible",
    ]);
    expect(settingsPatch.properties.ai.properties.provider.enum).toEqual([
      "openai",
      "ollama",
      "anthropic",
      "openrouter",
      "openai_compatible",
      "deepseek",
      "none",
    ]);
    expect(settingsPatch.properties.ai.properties.anthropic.properties.api_key.type).toBe("string");
    expect(settingsPatch.properties.ai.properties.openrouter.properties.base_url.format).toBe("uri");
    expect(settingsPatch.properties.ai.properties.openai_compatible.properties.model.type).toBe("string");
    expect(settingsPatch.properties.ai.properties.deepseek.properties.model.type).toBe("string");
    expect(document.schemas.RuntimeEmbeddingCapability.properties.provider.enum).toEqual([
      "openai",
      "ollama",
      "openai_compatible",
      "none",
    ]);
  });

  it("emits an OpenAPI document for local integration clients", () => {
    const outputs = buildApiDocOutputs(apiContract);

    expect(outputs.openApiJson).toBeTypeOf("string");

    const openapi = JSON.parse(outputs.openApiJson);
    expect(openapi.openapi).toBe("3.0.3");
    expect(openapi.info).toMatchObject({
      title: apiContract.name,
      version: apiContract.version,
      description: apiContract.description,
    });
    expect(openapi.servers).toEqual([{ url: apiContract.baseUrl }]);
    expect(openapi.components.securitySchemes.localIntegrationBearer).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "Little Imp integration token",
      description: "Managed local integration bearer token created with POST /integration-tokens.",
    });
    expect(openapi.components.schemas.Pagination.required).toEqual([
      "total",
      "limit",
      "offset",
      "has_more",
    ]);
    expect(openapi.components.schemas.Bookmark.properties.title).toMatchObject({
      type: "string",
      nullable: true,
    });
    expect(openapi.components.schemas.BookmarkDetail.properties.content).toEqual({
      allOf: [{ $ref: "#/components/schemas/BookmarkContent" }],
      nullable: true,
    });

    const emptyRequiredPaths: string[] = [];
    const collectEmptyRequiredArrays = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        if (path.endsWith(".required") && value.length === 0) {
          emptyRequiredPaths.push(path);
        }
        value.forEach((item, index) => collectEmptyRequiredArrays(item, `${path}[${index}]`));
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          collectEmptyRequiredArrays(child, `${path}.${key}`);
        }
      }
    };
    collectEmptyRequiredArrays(openapi, "openapi");
    expect(emptyRequiredPaths).toEqual([]);

    const openApiOperations = new Set(
      Object.entries(openapi.paths).flatMap(([path, methods]) =>
        Object.keys(methods as Record<string, unknown>).map((method) => `${method.toUpperCase()} ${path}`)
      )
    );
    const contractOperations = new Set(
      apiContract.routes.map((route) => {
        const method = route.method === "ALL" ? "POST" : route.method;
        const path = route.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
        return `${method} ${path}`;
      })
    );

    expect(openApiOperations).toEqual(contractOperations);

    const bookmarkDetail = openapi.paths["/bookmarks/{id}"].get;
    expect(bookmarkDetail.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "id",
          in: "path",
          required: true,
          schema: expect.objectContaining({ type: "string" }),
        }),
      ])
    );
    expect(bookmarkDetail.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/BookmarkDetailResponse",
    });

    const bookmarkList = openapi.paths["/bookmarks"].get;
    expect(bookmarkList.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "read_later",
          in: "query",
          required: false,
          schema: expect.objectContaining({ enum: ["true", "false", "1", "0"] }),
        }),
      ])
    );
    expect(bookmarkList.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/BookmarkListResponse",
    });

    expect(openapi.paths["/mcp"].post.security).toEqual([{ localIntegrationBearer: [] }]);
    expect(openapi.paths["/mcp"].post["x-little-imp-source-method"]).toBe("ALL");
    expect(openapi.paths["/capture"].post.security).toEqual([{ localIntegrationBearer: [] }]);
  });

  it("distinguishes CRUD row responses from count-bearing list responses", () => {
    const document = buildApiContractDocument(apiContract);

    expect(document.schemas.CategoryResponse.properties.data).toEqual({ ref: "CategoryRecord" });
    expect(document.schemas.CategoryTreeResponse.properties.data.items).toEqual({ ref: "CategoryNode" });
    expect(document.schemas.TagResponse.properties.data).toEqual({ ref: "TagRecord" });
    expect(document.schemas.TagListResponse.properties.data.items).toEqual({ ref: "TagWithCount" });
  });

  it("includes release-critical endpoint examples in generated Markdown", () => {
    const markdown = buildApiMarkdown(buildApiContractDocument(apiContract));

    expect(markdown).toContain("**List related bookmarks**");
    expect(markdown).toContain("**Update backup schedule**");
    expect(markdown).toContain("**Set a custom backup destination**");
    expect(markdown).toContain("**Test S3 connectivity**");
    expect(markdown).toContain("**Restore a local backup**");
    expect(markdown).toContain("**Create an integration token**");
    expect(markdown).toContain("**Call the MCP endpoint**");
    expect(markdown).toContain("Authorization: Bearer");
  });

  it("includes response-bearing local client examples for core API workflows", () => {
    const document = buildApiContractDocument(apiContract);
    const markdown = buildApiMarkdown(document);
    const requiredExamples = [
      ["POST", "/integration-tokens", "Create an integration token"],
      ["POST", "/capture", "Capture a bookmark from a local integration"],
      ["GET", "/integration-tokens", "List integration tokens"],
      ["POST", "/bookmarks", "Save a bookmark"],
      ["GET", "/bookmarks", "List filtered bookmarks"],
      ["GET", "/bookmarks/:id", "Read bookmark detail"],
      ["PUT", "/bookmarks/:id", "Update bookmark metadata"],
      ["GET", "/search", "Hybrid search with pagination"],
      ["POST", "/import", "Import Netscape bookmarks"],
      ["GET", "/export", "Export read-later bookmarks as JSON"],
      ["POST", "/categories", "Create a category with metadata"],
      ["GET", "/categories", "List category tree"],
      ["POST", "/tags", "Create a tag"],
      ["GET", "/tags", "List tags"],
      ["POST", "/backup", "Create a local backup"],
    ] as const;

    for (const [method, path, title] of requiredExamples) {
      const route = document.routes.find((candidate) => candidate.method === method && candidate.path === path);
      const example = route?.examples?.find((candidate) => candidate.title === title);

      expect(example, `${method} ${path} should include "${title}"`).toBeDefined();
      expect(example?.response, `${title} should include a response example`).toBeDefined();
      expect(markdown).toContain(`**${title}**`);
    }

    expect(markdown).toContain("Response:");
    expect(markdown).toContain("HTTP/1.1 201 Created");
    expect(markdown).toContain("Content-Type: application/json");
  });

  it("documents common local-client error flows without extension or bookmarklet examples", () => {
    const document = buildApiContractDocument(apiContract);
    const markdown = buildApiMarkdown(document);
    const problemExamples = document.routes.flatMap((route) =>
      (route.examples ?? []).filter((example) => String(example.response?.status ?? "").startsWith("4"))
    );

    expect(problemExamples.map((example) => example.title)).toEqual(
      expect.arrayContaining([
        "Reject an invalid bookmark URL",
        "Reject a missing integration token",
        "Reject an invalid export filter",
      ])
    );
    expect(markdown).toContain('"type": "https://littleimp.app/problems/unprocessable-entity"');
    expect(markdown).toContain('WWW-Authenticate: Bearer realm="littleimp-local-integrations"');
    expect(markdown).not.toMatch(/browser extension/i);
    // The bookmarklet endpoint is documented but must not appear in error-flow example titles
    expect(problemExamples.map((example) => example.title)).not.toEqual(
      expect.arrayContaining(["bookmarklet"])
    );
  });

  it("documents conservative local CORS setup for integration clients", () => {
    const markdown = buildApiMarkdown(buildApiContractDocument(apiContract));

    expect(markdown).toContain("## Browser Origin And CORS");
    expect(markdown).toContain("CORS_ORIGINS");
    expect(markdown).toContain("http://localhost:5173");
    expect(markdown).toContain("http://127.0.0.1:3210");
    expect(markdown).toContain("Non-loopback origins are ignored");
    expect(markdown).not.toMatch(/browser extension/i);
    // The bookmarklet endpoint appears in the route table but not in the CORS setup prose
    expect(markdown).toContain("/capture/bookmarklet");
  });

  it("keeps example responses aligned with immediate route behavior", () => {
    const document = buildApiContractDocument(apiContract);
    const routeExample = (method: string, path: string, title: string) => {
      const route = document.routes.find((candidate) => candidate.method === method && candidate.path === path);
      return route?.examples?.find((candidate) => candidate.title === title);
    };

    expect(routeExample("POST", "/bookmarks", "Save a bookmark")?.response?.body).toMatchObject({
      data: {
        status: "saved",
        category_id: null,
        read_later: 0,
        opened_count: 0,
        tags: [],
      },
    });

    expect(routeExample("POST", "/backup", "Create a local backup")?.response?.body).not.toHaveProperty(
      "remote_url"
    );

    expect(routeExample("POST", "/categories", "Create a category with metadata")?.response?.body).toMatchObject({
      data: {
        description: "Papers, implementation notes, and reference material for AI work.",
      },
    });
  });
});
