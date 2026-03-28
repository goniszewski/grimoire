# Contributing to Little Imp

Thank you for your interest in contributing to Little Imp! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) 1.x or later
- Node.js 18+ (for frontend development tools)
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/goniszewski/little-imp.git
cd little-imp

# Install frontend dependencies
npm install

# Install daemon dependencies
cd daemon && bun install

# Start development servers
npm run dev          # Frontend (Vite)
npm run daemon:dev   # Backend (Bun)
```

## Project Structure

```
little-imp/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   └── types/             # TypeScript type definitions
├── daemon/                 # Backend Bun/Hono daemon
│   ├── src/
│   │   ├── db/            # Database repositories and migrations
│   │   ├── routes/        # API endpoints
│   │   ├── pipeline/      # Content extraction pipeline
│   │   ├── ai/            # AI enrichment and organization
│   │   └── test/          # Backend tests
│   └── platform/          # Platform-specific files (systemd, LaunchAgent)
├── docs/                   # Documentation
├── tasks/                  # Task specifications and tracking
└── e2e/                    # End-to-end tests
```

## Development Workflow

### Frontend Development

```bash
# Start frontend development server
npm run dev

# Run frontend tests
npm run test
npm run test:watch

# Run linting
npm run lint

# Build for production
npm run build
```

### Backend Development

```bash
# Navigate to daemon directory
cd daemon

# Start daemon in development mode
bun run dev

# Run backend tests
bun test

# Type checking
bun run check
```

### Full Stack Testing

```bash
# Run all tests
npm run test        # Frontend tests
npm run test:e2e    # End-to-end tests
cd daemon && bun test  # Backend tests
```

## Code Guidelines

### TypeScript

- Use strict TypeScript configuration
- Define explicit return types for functions
- Use interfaces for object shapes
- Avoid `any` type - use `unknown` or specific types instead

### React Components

- Use functional components with hooks
- Follow the existing component structure
- Use proper TypeScript types for props
- Keep components focused and single-purpose

### Backend Code

- Use ES modules (`import`/`export`)
- Handle errors gracefully with proper logging
- Use the existing repository pattern for database access
- Follow the established route structure

### Testing

- Write tests for new features
- Maintain or improve current test coverage
- Use descriptive test names
- Mock external dependencies appropriately

## Database Changes

### Migrations

When modifying the database schema:

1. Create a new migration file in `daemon/src/db/migrations/`
2. Follow the naming convention: `NNNN_description.sql`
3. Ensure migrations are reversible when possible
4. Test migrations on a fresh database

### Example Migration

```sql
-- 0009_add_new_feature.sql
-- Add a new column to bookmarks table

ALTER TABLE bookmarks ADD COLUMN new_column TEXT;

-- Down migration (if needed)
-- ALTER TABLE bookmarks DROP COLUMN new_column;
```

## API Development

### Route Structure

- Place new routes in appropriate files under `daemon/src/routes/`
- Follow RESTful conventions
- Use proper HTTP status codes
- Include error handling and validation

### Example Route

```typescript
// daemon/src/routes/feature.ts
import { Hono } from 'hono';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

export function createFeatureRoute(deps: RouteDeps) {
  const router = new Hono();
  
  router.post('/', async (c) => {
    const body = await c.req.json();
    const data = schema.parse(body);
    
    // Implementation here
    
    return c.json({ success: true });
  });
  
  return router;
}
```

## AI Integration

### Adding New AI Features

1. Consider privacy implications - local-first approach preferred
2. Use the existing LLM client abstraction
3. Provide fallback behavior when AI is unavailable
4. Document any new environment variables required

### Environment Variables

New AI features should use the established pattern:

```typescript
const API_KEY = process.env.MY_FEATURE_API_KEY;
if (!API_KEY) {
  log.info('My feature disabled - API key not configured');
  return;
}
```

## Testing Guidelines

### Unit Tests

- Test individual functions and methods
- Use descriptive test names
- Mock external dependencies
- Test both success and error cases

### Integration Tests

- Test API endpoints with real database
- Use the test database helpers
- Clean up test data after tests
- Test authentication and authorization

### E2E Tests

- Test complete user workflows
- Use Playwright for browser automation
- Test on multiple browsers when relevant
- Include accessibility testing

## Submitting Changes

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the guidelines above
4. Run all tests and ensure they pass
5. Commit with clear, descriptive messages
6. Push to your fork and submit a pull request

### Pull Request Guidelines

- Provide a clear description of changes
- Reference any related issues
- Include screenshots for UI changes
- Update documentation as needed
- Ensure all tests pass
- Keep changes focused and atomic

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add semantic search with embeddings
fix: resolve bookmark deletion cascade issue
docs: update API documentation for categories
refactor: simplify pipeline error handling
test: add integration tests for backup feature
```

## Getting Help

If you need help or have questions:

- Check existing documentation and issues
- Create an issue with the "question" label
- Be specific about your problem or question
- Include relevant code snippets or error messages

## Recognition

Contributors will be recognized in:

- The project README
- Release notes for significant contributions
- The project's contributor list

Thank you for contributing to Little Imp! 🎉
