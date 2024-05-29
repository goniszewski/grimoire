import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import * as schema from './schema';

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

class DbConnection {
	private static instance: DbConnection;
	private db: Database;

	private constructor() {
		this.db = new Database('../../data/db.sqlite', { create: true });
		this.db.exec('PRAGMA journal_mode = WAL;');
	}

	public static getInstance(): DbConnection {
		if (!DbConnection.instance) {
			DbConnection.instance = new DbConnection();
		}

		return DbConnection.instance;
	}

	public getClient(): BunSQLiteDatabase<typeof schema> {
		return drizzle(this.db, { schema: { ...schema } });
	}
}

const dbConnection = DbConnection.getInstance();
export const db = dbConnection.getClient();
