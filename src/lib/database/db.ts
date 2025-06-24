import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import fs from 'fs';
import path from 'path';

import * as schema from './schema';

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
export type DB = BunSQLiteDatabase<typeof schema>;

class DbConnection {
	private static instance: DbConnection;
	private db: Database;

	private constructor() {
		const dbPath = path.join(path.resolve(process.cwd(), 'data'), 'db.sqlite');

		const dataDir = path.dirname(dbPath);
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}

		this.db = new Database(dbPath, {
			create: true
		});
		this.db.exec('PRAGMA journal_mode = WAL;');
	}

	public static getInstance(): DbConnection {
		if (!DbConnection.instance) {
			DbConnection.instance = new DbConnection();
		}

		return DbConnection.instance;
	}

	public getClient(): DB {
		return drizzle(this.db, {
			schema
		});
	}
}

const dbConnection = DbConnection.getInstance();
export const db = dbConnection.getClient();
