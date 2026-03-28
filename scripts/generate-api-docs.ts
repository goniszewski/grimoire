#!/usr/bin/env bun

/**
 * API Documentation Generator for Little Imp
 * 
 * This script generates comprehensive API documentation by analyzing:
 * - Route definitions in daemon/src/routes/
 * - TypeScript types and interfaces
 * - Zod schemas for validation
 * - Database schema
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const ROUTES_DIR = join(PROJECT_ROOT, 'daemon', 'src', 'routes');
const TYPES_DIR = join(PROJECT_ROOT, 'daemon', 'src', 'types');
const DB_DIR = join(PROJECT_ROOT, 'daemon', 'src', 'db');
const OUTPUT_FILE = join(PROJECT_ROOT, 'API.md');

interface RouteInfo {
  file: string;
  routes: RouteDefinition[];
  imports: string[];
}

interface RouteDefinition {
  method: string;
  path: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: string;
  responseBody?: string;
  statusCodes?: StatusCode[];
  middleware?: string[];
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  location: 'path' | 'query' | 'header';
}

interface StatusCode {
  code: number;
  description: string;
}

class ApiDocGenerator {
  private routes: RouteInfo[] = [];
  private types: Map<string, string> = new Map();
  private schemas: Map<string, unknown> = new Map();

  async generate(): Promise<void> {
    console.log('🔍 Analyzing routes...');
    await this.analyzeRoutes();
    
    console.log('🔍 Extracting types...');
    await this.extractTypes();
    
    console.log('🔍 Analyzing database schema...');
    await this.analyzeDatabaseSchema();
    
    console.log('📝 Generating documentation...');
    const documentation = this.generateMarkdown();
    
    console.log('💾 Writing API documentation...');
    writeFileSync(OUTPUT_FILE, documentation);
    
    console.log(`✅ API documentation generated: ${OUTPUT_FILE}`);
  }

  private async analyzeRoutes(): Promise<void> {
    const routeFiles = this.getTypeScriptFiles(ROUTES_DIR);
    
    for (const file of routeFiles) {
      const content = readFileSync(file, 'utf-8');
      const routeInfo = this.parseRouteFile(file, content);
      if (routeInfo.routes.length > 0) {
        this.routes.push(routeInfo);
      }
    }
  }

  private getTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];
    
    function traverse(currentDir: string) {
      const entries = readdirSync(currentDir);
      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (extname(entry) === '.ts') {
          files.push(fullPath);
        }
      }
    }
    
    traverse(dir);
    return files;
  }

  private parseRouteFile(filePath: string, content: string): RouteInfo {
    const fileName = basename(filePath);
    const routes: RouteDefinition[] = [];
    const imports: string[] = [];

    // Extract imports
    const importMatches = content.match(/^import\s+.*?from\s+['"].*?['"];?$/gm);
    if (importMatches) {
      imports.push(...importMatches);
    }

    // Look for route definitions
    // This is a simplified parser - in a real implementation, you'd use AST parsing
    const routePatterns = [
      // router.get('/path', handler)
      /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      // router.route('/path').get(handler)
      /router\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.(get|post|put|delete|patch)/g,
    ];

    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];
        
        // Extract additional information from the route
        const routeInfo = this.extractRouteDetails(content, match.index, method, path);
        routes.push(routeInfo);
      }
    }

    return { file: fileName, routes, imports };
  }

  private extractRouteDetails(content: string, matchIndex: number, method: string, path: string): RouteDefinition {
    // Extract handler function and analyze it
    const routeStart = content.lastIndexOf('router.', matchIndex);
    const routeEnd = this.findMatchingBracket(content, routeStart + content.substring(routeStart).indexOf('('));
    
    const routeContent = content.substring(routeStart, routeEnd + 1);
    
    return {
      method,
      path,
      description: this.extractDescription(routeContent),
      parameters: this.extractParameters(routeContent),
      requestBody: this.extractRequestBody(routeContent),
      responseBody: this.extractResponseBody(routeContent),
      statusCodes: this.extractStatusCodes(routeContent),
    };
  }

  private findMatchingBracket(content: string, startIndex: number): number {
    let bracketCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';
      
      // Handle string escaping
      if (char === '"' || char === "'" || char === '`') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar && prevChar !== '\\') {
          inString = false;
          stringChar = '';
        }
      }
      
      if (!inString) {
        if (char === '(') bracketCount++;
        if (char === ')') bracketCount--;
        if (bracketCount === 0) return i;
      }
    }
    
    return content.length - 1;
  }

  private extractDescription(content: string): string | undefined {
    // Look for JSDoc comments above the route
    const jsdocMatch = content.match(/\/\*\*\s*\n([\s\S]*?)\n\s*\*\//);
    if (jsdocMatch) {
      const description = jsdocMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, ''))
        .join(' ')
        .trim();
      return description;
    }
    return undefined;
  }

  private extractParameters(content: string): Parameter[] {
    const parameters: Parameter[] = [];
    
    // Look for parameter extraction patterns
    const paramPatterns = [
      /c\.req\.param\s*\(\s*['"`]([^'"`]+)['"`]/g, // c.req.param('id')
      /c\.req\.query\s*\(\s*['"`]([^'"`]+)['"`]/g, // c.req.query('search')
      /params\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, // params.id
      /query\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, // query.search
    ];
    
    for (const pattern of paramPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const paramName = match[1];
        const location = pattern.source.includes('param') ? 'path' : 'query';
        
        parameters.push({
          name: paramName,
          type: 'string', // Default to string, could be enhanced
          required: true,
          location,
        });
      }
    }
    
    return parameters;
  }

  private extractRequestBody(content: string): string | undefined {
    // Look for request body parsing
    if (content.includes('c.req.json()') || content.includes('await c.req.json()')) {
      return 'JSON object (structure depends on endpoint)';
    }
    if (content.includes('c.req.formData()')) {
      return 'FormData (multipart/form-data)';
    }
    return undefined;
  }

  private extractResponseBody(content: string): string | undefined {
    // Look for response patterns
    if (content.includes('c.json(')) {
      return 'JSON response';
    }
    if (content.includes('c.text(')) {
      return 'Plain text response';
    }
    if (content.includes('c.html(')) {
      return 'HTML response';
    }
    return undefined;
  }

  private extractStatusCodes(content: string): StatusCode[] {
    const statusCodes: StatusCode[] = [];
    
    // Look for explicit status code returns
    const statusPatterns = [
      /c\.json\s*\(\s*[^,]*,\s*(\d+)\s*\)/g, // c.json(data, 201)
      /c\.status\s*\(\s*(\d+)\s*\)/g, // c.status(404)
    ];
    
    for (const pattern of statusPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const code = parseInt(match[1]);
        const description = this.getStatusCodeDescription(code);
        statusCodes.push({ code, description });
      }
    }
    
    // Add default success status if not explicitly set
    if (statusCodes.length === 0) {
      statusCodes.push({ code: 200, description: 'Success' });
    }
    
    return statusCodes;
  }

  private getStatusCodeDescription(code: number): string {
    const descriptions: Record<number, string> = {
      200: 'Success',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
    };
    return descriptions[code] || 'Unknown status code';
  }

  private async extractTypes(): Promise<void> {
    const typeFiles = this.getTypeScriptFiles(TYPES_DIR);
    
    for (const file of typeFiles) {
      const content = readFileSync(file, 'utf-8');
      this.parseTypeDefinitions(content);
    }
  }

  private parseTypeDefinitions(content: string): void {
    // Extract interface and type definitions
    const interfaceMatches = content.match(/export\s+interface\s+([A-Z][a-zA-Z0-9_]*)\s*\{[^}]+\}/g);
    const typeMatches = content.match(/export\s+type\s+([A-Z][a-zA-Z0-9_]*)\s*=\s*[^;]+;/g);
    
    if (interfaceMatches) {
      for (const match of interfaceMatches) {
        const nameMatch = match.match(/interface\s+([A-Z][a-zA-Z0-9_]*)/);
        if (nameMatch) {
          this.types.set(nameMatch[1], match);
        }
      }
    }
    
    if (typeMatches) {
      for (const match of typeMatches) {
        const nameMatch = match.match(/type\s+([A-Z][a-zA-Z0-9_]*)/);
        if (nameMatch) {
          this.types.set(nameMatch[1], match);
        }
      }
    }
  }

  private async analyzeDatabaseSchema(): Promise<void> {
    // Look for migration files to understand the schema
    const migrationsDir = join(DB_DIR, 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      this.parseSchemaFromMigration(content);
    }
  }

  private parseSchemaFromMigration(content: string): void {
    // Extract CREATE TABLE statements
    const tableMatches = content.match(/CREATE\s+TABLE\s+`?(\w+)`?\s*\([^;]+\);/gi);
    if (tableMatches) {
      for (const match of tableMatches) {
        const tableNameMatch = match.match(/CREATE\s+TABLE\s+`?(\w+)`?/);
        if (tableNameMatch) {
          // Store table schema information
          // This is simplified - could be enhanced with proper parsing
        }
      }
    }
  }

  private generateMarkdown(): string {
    let markdown = '# Little Imp API Documentation\n\n';
    markdown += '> Auto-generated API documentation for the Little Imp daemon\n\n';
    markdown += '## Base URL\n\n';
    markdown += 'All API endpoints are relative to: `http://127.0.0.1:3210`\n\n';
    markdown += '## Authentication\n\n';
    markdown += 'Currently, no authentication is required as the daemon runs locally.\n\n';
    
    // Group routes by file/resource
    const groupedRoutes = this.groupRoutesByResource();
    
    for (const [resource, routes] of Object.entries(groupedRoutes)) {
      markdown += `## ${resource}\n\n`;
      
      for (const route of routes) {
        markdown += this.generateRouteDocumentation(route);
      }
    }
    
    // Add types section
    if (this.types.size > 0) {
      markdown += '## Types\n\n';
      for (const [name, definition] of this.types) {
        markdown += `### ${name}\n\n`;
        markdown += '```typescript\n';
        markdown += definition + '\n';
        markdown += '```\n\n';
      }
    }
    
    // Add database schema section
    markdown += '## Database Schema\n\n';
    markdown += 'See migration files in `daemon/src/db/migrations/` for the complete schema.\n\n';
    
    // Add example usage
    markdown += '## Example Usage\n\n';
    markdown += '### Adding a Bookmark\n\n';
    markdown += '```bash\n';
    markdown += 'curl -X POST http://127.0.0.1:3210/bookmarks \\\n';
    markdown += '  -H "Content-Type: application/json" \\\n';
    markdown += '  -d \'{"url": "https://example.com", "title": "Example Site"}\'\n';
    markdown += '```\n\n';
    
    markdown += '### Searching Bookmarks\n\n';
    markdown += '```bash\n';
    markdown += 'curl "http://127.0.0.1:3210/search?q=typescript&mode=keyword"\n';
    markdown += '```\n\n';
    
    return markdown;
  }

  private groupRoutesByResource(): Record<string, RouteDefinition[]> {
    const grouped: Record<string, RouteDefinition[]> = {};
    
    for (const routeInfo of this.routes) {
      for (const route of routeInfo.routes) {
        // Extract resource from path (e.g., '/bookmarks' -> 'Bookmarks')
        const pathParts = route.path.split('/').filter(p => p);
        const resource = pathParts[0] ? 
          pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1) : 
          'General';
        
        if (!grouped[resource]) {
          grouped[resource] = [];
        }
        grouped[resource].push(route);
      }
    }
    
    return grouped;
  }

  private generateRouteDocumentation(route: RouteDefinition): string {
    let doc = `### ${route.method} ${route.path}\n\n`;
    
    if (route.description) {
      doc += `${route.description}\n\n`;
    }
    
    // Parameters
    if (route.parameters && route.parameters.length > 0) {
      doc += '**Parameters:**\n\n';
      for (const param of route.parameters) {
        doc += `- \`${param.name}\` (${param.location}) - ${param.type}`;
        if (!param.required) doc += ' (optional)';
        if (param.description) doc += ` - ${param.description}`;
        doc += '\n';
      }
      doc += '\n';
    }
    
    // Request Body
    if (route.requestBody) {
      doc += `**Request Body:** ${route.requestBody}\n\n`;
    }
    
    // Response
    if (route.responseBody) {
      doc += `**Response:** ${route.responseBody}\n\n`;
    }
    
    // Status Codes
    if (route.statusCodes && route.statusCodes.length > 0) {
      doc += '**Status Codes:**\n\n';
      for (const status of route.statusCodes) {
        doc += `- \`${status.code}\` - ${status.description}\n`;
      }
      doc += '\n';
    }
    
    return doc;
  }
}

// Main execution
const generator = new ApiDocGenerator();
generator.generate().catch(console.error);