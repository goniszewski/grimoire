import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'sqlite',
	schema: './src/lib/database/schema.ts',
	out: './migrations',
	dbCredentials: {
		url: ''
	}
});
