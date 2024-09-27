import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import path from 'path';

import * as schema from './schema';

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
export type DB = BunSQLiteDatabase<typeof schema>;

class DbConnection {
	private static instance: DbConnection;
	private db: Database;

	private constructor() {
		this.db = new Database(path.join(path.resolve(process.cwd(), 'data'), 'db.sqlite'), {
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
