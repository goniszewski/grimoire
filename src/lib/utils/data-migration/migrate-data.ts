import type { DB } from '$lib/database/db';
import { db as targetDbClient } from '$lib/database/db';
import {
    bookmarkSchema, bookmarksToTagsSchema, categorySchema, fileSchema, tagSchema, userSchema
} from '$lib/database/schema';
import { FileSourceEnum, FileStorageTypeEnum } from '$lib/enums/files';
import AdmZip from 'adm-zip';
import { Database } from 'bun:sqlite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { unlink } from 'node:fs/promises';
import path from 'path';

import { createSlug } from '../create-slug';
import * as schema from './pb-schema';

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { UserSettings } from '$lib/types/UserSettings.type';
function extractBackup(backupPath: string, extractPath: string) {
	const zip = new AdmZip(backupPath);
	zip.extractAllTo(extractPath, true);
}

function getMigrationDbClient(dbPath: string) {
	const db = new Database(dbPath, { create: false, readonly: true });

	return drizzle(db, {
		schema
	});
}

async function migrateUsers(
	migrationDbClient: BunSQLiteDatabase<typeof schema>,
	targetDbClient: DB
) {
	const users = migrationDbClient.select().from(schema.users).all();
	const adminId = users.sort(
		(a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
	)[0].id;

	const serializedUsers = users.map((user) => ({
		name: user.name,
		username: user.username,
		email: user.email,
		passwordHash: user.passwordHash,
		avatarId: null,
		settings: user.settings as UserSettings,
		verified: user.verified,
		disabled: new Date(user.disabled),
		isAdmin: user.id === adminId,
		created: new Date(user.created),
		updated: new Date(user.updated)
	}));
	const createdUsers = await targetDbClient.insert(userSchema).values(serializedUsers).returning();

	const mappedIds = createdUsers.reduce(
		(acc, user) => {
			acc[user.username] = user.id;
			return acc;
		},
		{} as Record<string, number>
	);

	return mappedIds;
}

async function migrateCategories(
	migrationDbClient: BunSQLiteDatabase<typeof schema>,
	targetDbClient: DB,
	mappedUserIds: Record<string, number>
) {
	const categories = migrationDbClient.select().from(schema.categories).all();
	const serializedCategories = categories.map((category) => ({
		name: category.name,
		slug: category.slug,
		description: category.description,
		ownerId: mappedUserIds[category.owner],
		created: new Date(category.created),
		updated: new Date(category.updated)
	}));
	const createdCategories = await targetDbClient
		.insert(categorySchema)
		.values(serializedCategories)
		.returning();

	const mappedIds = createdCategories.reduce(
		(acc, category) => {
			acc[category.slug] = category.id;
			return acc;
		},
		{} as Record<string, number>
	);

	return mappedIds;
}

async function migrateBookmarks(
	migrationDbClient: BunSQLiteDatabase<typeof schema>,
	targetDbClient: DB,
	mappedUserIds: Record<string, number>,
	mappedCategoryIds: Record<string, number>,
	mappedTagIds: Record<string, number>
) {
	const bookmarks = migrationDbClient.select().from(schema.bookmarks).all();
	const serializedBooks = bookmarks.map((book) => ({
		domain: book.domain,
		title: book.title,
		url: book.url,
		slug: createSlug(book.title),
		description: book.description,
		ownerId: mappedUserIds[book.owner],
		categoryId: mappedCategoryIds[book.category],
		created: new Date(book.created),
		updated: new Date(book.updated)
	}));
	const createdBooks = await targetDbClient
		.insert(bookmarkSchema)
		.values(serializedBooks)
		.returning();
	const mappedIds = createdBooks.reduce(
		(acc, book) => {
			acc[book.id] = book.id;
			return acc;
		},
		{} as Record<string, number>
	);

	await targetDbClient.insert(bookmarksToTagsSchema).values(
		bookmarks
			.map((book) =>
				book.tags.map((tag) => ({
					bookmarkId: mappedIds[book.id],
					tagId: mappedTagIds[tag]
				}))
			)
			.flat()
	);

	return mappedIds;
}

async function migrateTags(
	migrationDbClient: BunSQLiteDatabase<typeof schema>,
	targetDbClient: DB,
	mappedUserIds: Record<string, number>
) {
	const tags = migrationDbClient.select().from(schema.tags).all();
	const serializedTags = tags.map((tag) => ({
		name: tag.name,
		slug: tag.slug,
		ownerId: mappedUserIds[tag.owner],
		created: new Date(tag.created),
		updated: new Date(tag.updated)
	}));

	const createdTags = await targetDbClient.insert(tagSchema).values(serializedTags).returning();
	const mappedIds = createdTags.reduce(
		(acc, tag) => {
			acc[tag.slug] = tag.id;
			return acc;
		},
		{} as Record<string, number>
	);

	return mappedIds;
}

async function copyFileAndRemoveOld(fromPath: string, toPath: string) {
	const fromFile = Bun.file(fromPath);
	const toFile = Bun.file(toPath);

	await Bun.write(fromFile, toFile);
	await unlink(fromPath);
}

function createFilePath(
	ownerId: number,
	entityId: number,
	fileType: 'icon' | 'mainImage' | 'screenshot'
) {
	return path.join(ownerId.toString(), entityId.toString(), fileType);
}

async function handleBookmarkImageMigration(
	targetDbClient: DB,
	sourceFilePath: string,
	sourceFileMimeType: string,
	ownerId: number,
	bookmarkId: number,
	fileType: 'icon' | 'mainImage' | 'screenshot'
) {
	const targetFilePath = createFilePath(ownerId, bookmarkId, fileType);
	const [dbObject] = await targetDbClient
		.insert(fileSchema)
		.values({
			ownerId,
			fileName: fileType,
			source: FileSourceEnum.Upload,
			storageType: FileStorageTypeEnum.Local,
			mimeType: sourceFileMimeType,
			relativePath: targetFilePath
		})
		.returning();

	await copyFileAndRemoveOld(sourceFilePath, targetFilePath);
	await targetDbClient
		.update(bookmarkSchema)
		.set({
			[`${fileType}Id`]: dbObject.id
		})
		.where(eq(bookmarkSchema.id, bookmarkId));
}

async function migrateBookmarkImages(
	migrationDbClient: BunSQLiteDatabase<typeof schema>,
	targetDbClient: DB,
	mappedBookmarkIds: Record<string, number>,
	mappedUserIds: Record<string, number>,
	sourceFileDir: string // path do backup's 'storage' dir
) {
	const bookmarks = migrationDbClient
		.select({
			id: schema.bookmarks.id,
			ownerId: schema.bookmarks.owner,
			icon: schema.bookmarks.icon,
			mainImage: schema.bookmarks.mainImage,
			screenshot: schema.bookmarks.screenshot
		})
		.from(schema.bookmarks)
		.all();
	const bookmarkFilePaths: Record<
		string,
		{
			icon?: string;
			mainImage?: string;
			screenshot?: string;
			ownerId: number;
			sourceOwnerId: string;
		}
	> = bookmarks.reduce(
		(acc, bookmark) => {
			const entry: {
				icon?: string;
				mainImage?: string;
				screenshot?: string;
				ownerId: number;
				sourceOwnerId: string;
			} = {
				ownerId: mappedUserIds[bookmark.ownerId],
				sourceOwnerId: bookmark.ownerId
			};

			if (bookmark.icon) {
				entry.icon = bookmark.icon;
			}
			if (bookmark.mainImage) {
				entry.mainImage = bookmark.mainImage;
			}
			if (bookmark.screenshot) {
				entry.screenshot = bookmark.screenshot;
			}

			acc[bookmark.id] = entry;
			return acc;
		},
		{} as Record<
			string,
			{
				icon?: string;
				mainImage?: string;
				screenshot?: string;
				ownerId: number;
				sourceOwnerId: string;
			}
		>
	);

	for (const [bookmarkId, bookmarkFilePath] of Object.entries(bookmarkFilePaths)) {
		const sourceFilePathDir = path.join(
			sourceFileDir,
			bookmarkFilePath.sourceOwnerId,
			bookmarkId
		);
		if (bookmarkFilePath.icon) {
			await handleBookmarkImageMigration(
				targetDbClient,
				`${sourceFilePathDir}/${bookmarkFilePath.icon}`,
				'image/png', // TODO: get mime type from file extension
				bookmarkFilePath.ownerId,
				mappedBookmarkIds[bookmarkId],
				'icon'
			);
		}
		if (bookmarkFilePath.mainImage) {
			await handleBookmarkImageMigration(
				targetDbClient,
				`${sourceFilePathDir}/${bookmarkFilePath.mainImage}`,
				'image/png', // TODO: get mime type from file extension
				bookmarkFilePath.ownerId,
				mappedBookmarkIds[bookmarkId],
				'mainImage'
			);
		}
		if (bookmarkFilePath.screenshot) {
			await handleBookmarkImageMigration(
				targetDbClient,
				`${sourceFilePathDir}/${bookmarkFilePath.screenshot}`,
				'image/png', // TODO: get mime type from file extension
				bookmarkFilePath.ownerId,
				mappedBookmarkIds[bookmarkId],
				'screenshot'
			);
		}
	}
}
export async function migrateData(backupPath: string, dbPath: string) {
	const extractPath = path.join(process.cwd(), 'data', 'temp', `migration_backup_${Date.now()}`);
	extractBackup(backupPath, extractPath);

	const migrationDbClient = getMigrationDbClient(dbPath);

	const mappedUserIds = await migrateUsers(migrationDbClient, targetDbClient);
	const mappedCategoryIds = await migrateCategories(
		migrationDbClient,
		targetDbClient,
		mappedUserIds
	);
	const mappedTagIds = await migrateTags(migrationDbClient, targetDbClient, mappedUserIds);
	const mappedBookmarkIds = await migrateBookmarks(
		migrationDbClient,
		targetDbClient,
		mappedUserIds,
		mappedCategoryIds,
		mappedTagIds
	);
	await migrateBookmarkImages(
		migrationDbClient,
		targetDbClient,
		mappedBookmarkIds,
		mappedUserIds,
		extractPath
	);
}
