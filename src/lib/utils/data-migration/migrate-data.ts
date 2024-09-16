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
import { exists, readdir, rm, unlink } from 'node:fs/promises';
import path from 'path';

import { hash } from '@node-rs/argon2';

import { createSlug } from '../create-slug';
import * as schema from './pb-schema';

import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { UserSettings } from '$lib/types/UserSettings.type';
import type { MigrationResult } from './migration.types';

export const DEFAULT_USER_PASSWORD = 'changeme';
function extractBackup(backupPath: string, extractPath: string) {
	const zip = new AdmZip(backupPath);
	zip.extractAllTo(extractPath, true);
}

async function deleteBackupFiles(backupPath: string, extractPath: string) {
	return Promise.all([unlink(backupPath), rm(extractPath, { recursive: true, force: true })]);
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

	const passwordHash = await hash(DEFAULT_USER_PASSWORD, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});

	const serializedUsers = users.map((user) => ({
		name: user.name,
		username: user.username,
		email: user.email,
		passwordHash,
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
			const oldId = users.find((u) => u.name === user.name)?.id!;
			acc[oldId] = user.id;
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
	const serializedCategories: (typeof categorySchema.$inferInsert)[] = categories.map(
		(category) => ({
			name: category.name,
			slug: category.slug,
			description: category.description,
			color: category.color,
			archived: category.archived ? new Date(category.archived) : null,
			public: category.public ? new Date(category.public) : null,
			icon: category.icon,
			initial: category.initial,
			ownerId: mappedUserIds[category.owner],
			created: new Date(category.created),
			updated: new Date(category.updated)
		})
	);
	const createdCategories = await targetDbClient
		.insert(categorySchema)
		.values(serializedCategories)
		.returning();

	const mappedIds = createdCategories.reduce(
		(acc, category) => {
			const oldId = categories.find((c) => {
				const slugMatch = c.slug.trim().toLowerCase() === category.slug.trim().toLowerCase();
				const ownerMatch = mappedUserIds[c.owner] === category.ownerId;

				return slugMatch && ownerMatch;
			})?.id!;

			if (!oldId) {
				console.warn(
					`Failed to match category: ${category.name} (${category.slug}) for user ${category.ownerId}`
				);
			}

			acc[oldId] = category.id;
			return acc;
		},
		{} as Record<string, number>
	);

	// Update parentId of categories that have a parentId
	const categoriesWithParentId = categories.filter((c) => c.parent);
	await targetDbClient
		.update(categorySchema)
		.set({
			parentId: mappedIds[categoriesWithParentId[0].parent],
			updated: new Date()
		})
		.where(eq(categorySchema.id, mappedIds[categoriesWithParentId[0].id]));

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
	const serializedBooks: (typeof bookmarkSchema.$inferInsert)[] = bookmarks.map((book) => ({
		domain: book.domain,
		title: book.title,
		url: book.url,
		slug: createSlug(book.title),
		description: book.description,
		mainImageUrl: book.mainImageUrl,
		iconUrl: book.iconUrl,
		importance: book.importance,
		flagged: book.flagged ? new Date(book.flagged) : null,
		read: book.read ? new Date(book.read) : null,
		archived: book.archived ? new Date(book.archived) : null,
		openedLast: book.openedLast ? new Date(book.openedLast) : null,
		openedTimes: book.openedTimes,
		contentHtml: book.contentHtml,
		contentText: book.contentText,
		contentType: book.contentType,
		author: book.author,
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
			const oldId = bookmarks.find(
				(b) =>
					b.title === book.title &&
					Object.entries(mappedUserIds).find(([_, value]) => value === book.ownerId)?.[0]
			)?.id!;
			acc[oldId] = book.id;
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
			const oldId = tags.find((t) => t.name === tag.name)?.id!;
			acc[oldId] = tag.id;
			return acc;
		},
		{} as Record<string, number>
	);

	return mappedIds;
}

async function copyFileAndRemoveOld(fromPath: string, toPath: string) {
	console.log(`copyFileAndRemoveOld => Copying ${fromPath} to ${toPath}`);
	const fromFile = Bun.file(fromPath);
	const toFile = Bun.file(toPath);

	await Bun.write(toFile, fromFile, {
		createPath: true
	});
	await unlink(fromPath);
}

function createFilePath(
	targetFileDir: string,
	ownerId: number,
	entityId: number,
	fileType: 'icon' | 'mainImage' | 'screenshot',
	extension?: string
) {
	return path.join(
		targetFileDir,
		ownerId.toString(),
		entityId.toString(),
		`${fileType}${extension || ''}`
	);
}

async function handleBookmarkImageMigration(
	targetDbClient: DB,
	sourceFilePath: string,
	ownerId: number,
	bookmarkId: number,
	fileType: 'icon' | 'mainImage' | 'screenshot'
) {
	console.log(`handleBookmarkImageMigration => Copying ${sourceFilePath} to ${fileType}`);
	const sourceFileExtension = path.extname(sourceFilePath);
	const { type: mimeType, size } = Bun.file(sourceFilePath);
	const userUploadsDir = path.join(process.cwd(), 'data', 'user-uploads');
	const targetFilePath = createFilePath(
		userUploadsDir,
		ownerId,
		bookmarkId,
		fileType,
		sourceFileExtension
	);
	const relativePath = path
		.join(ownerId.toString(), bookmarkId.toString(), `${fileType}${sourceFileExtension}`)
		.replaceAll(userUploadsDir, '');
	const [dbObject] = await targetDbClient
		.insert(fileSchema)
		.values({
			ownerId,
			fileName: fileType,
			source: FileSourceEnum.Upload,
			storageType: FileStorageTypeEnum.Local,
			mimeType,
			size,
			relativePath
		})
		.returning();

	await copyFileAndRemoveOld(sourceFilePath, targetFilePath);
	await targetDbClient
		.update(bookmarkSchema)
		.set({
			[`${fileType}Id`]: dbObject.id,
			updated: new Date()
		})
		.where(eq(bookmarkSchema.id, bookmarkId));
}

async function findFilePath(sourceFileDir: string, entityId: string, fileName: string) {
	const sourceDirContent = await readdir(sourceFileDir, { withFileTypes: true });
	const directories = sourceDirContent
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	const actualFilePath = await Promise.all(
		directories.map(async (directory) => {
			const possibleEntityPath = path.join(sourceFileDir, directory, entityId);
			const possibleEntityPathExists = await exists(possibleEntityPath);

			if (!possibleEntityPathExists) {
				return null;
			}

			const actualFilePath = path.join(possibleEntityPath, fileName);
			console.log('findFilePath.actualFilePath', actualFilePath);

			return actualFilePath;
		})
	).then((paths) => paths.filter((path) => path !== null)?.[0]);

	return actualFilePath;
}

async function migrateBookmarkImages(
	migrationDbClient: BunSQLiteDatabase<typeof schema>,
	targetDbClient: DB,
	mappedBookmarkIds: Record<string, number>,
	mappedUserIds: Record<string, number>,
	sourceFileDir: string // path do backup's 'storage' dir
) {
	let migratedImageCount = 0;
	const storageFileDir = path.join(sourceFileDir, 'storage');

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
			sourceBookmarkId: string;
		}
	> = bookmarks.reduce(
		(acc, bookmark) => {
			const entry: {
				icon?: string;
				mainImage?: string;
				screenshot?: string;
				ownerId: number;
				sourceBookmarkId: string;
			} = {
				ownerId: mappedUserIds[bookmark.ownerId],
				sourceBookmarkId: bookmark.id
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
				sourceBookmarkId: string;
			}
		>
	);

	for (const [bookmarkId, bookmarkFilePath] of Object.entries(bookmarkFilePaths)) {
		if (bookmarkFilePath.icon) {
			const sourceFilePath = await findFilePath(
				storageFileDir,
				bookmarkFilePath.sourceBookmarkId,
				bookmarkFilePath.icon
			);
			console.log(`handleBookmarkImageMigration => Copying ${sourceFilePath} to icon`);
			await handleBookmarkImageMigration(
				targetDbClient,
				sourceFilePath,
				bookmarkFilePath.ownerId,
				mappedBookmarkIds[bookmarkId],
				'icon'
			);
			migratedImageCount++;
		}
		if (bookmarkFilePath.mainImage) {
			const sourceFilePath = await findFilePath(
				storageFileDir,
				bookmarkFilePath.sourceBookmarkId,
				bookmarkFilePath.mainImage
			);
			console.log(`handleBookmarkImageMigration => Copying ${sourceFilePath} to mainImage`);
			await handleBookmarkImageMigration(
				targetDbClient,
				sourceFilePath,
				bookmarkFilePath.ownerId,
				mappedBookmarkIds[bookmarkId],
				'mainImage'
			);
			migratedImageCount++;
		}
		if (bookmarkFilePath.screenshot) {
			const sourceFilePath = await findFilePath(
				storageFileDir,
				bookmarkFilePath.sourceBookmarkId,
				bookmarkFilePath.screenshot
			);
			console.log(`handleBookmarkImageMigration => Copying ${sourceFilePath} to screenshot`);
			await handleBookmarkImageMigration(
				targetDbClient,
				sourceFilePath,
				bookmarkFilePath.ownerId,
				mappedBookmarkIds[bookmarkId],
				'screenshot'
			);
			migratedImageCount++;
		}
	}

	return migratedImageCount;
}
export async function migrateData(backupPath: string): Promise<MigrationResult> {
	const extractPath = path.join(process.cwd(), 'data', 'temp', `migration_backup_${Date.now()}`);
	const extractedDbPath = path.join(extractPath, 'data.db');
	extractBackup(backupPath, extractPath);

	const migrationDbClient = getMigrationDbClient(extractedDbPath);

	const mappedUserIds = await migrateUsers(migrationDbClient, targetDbClient);
	console.log('Mapped user IDs:', mappedUserIds);
	const mappedCategoryIds = await migrateCategories(
		migrationDbClient,
		targetDbClient,
		mappedUserIds
	);
	console.log('Mapped category IDs:', mappedCategoryIds);
	const mappedTagIds = await migrateTags(migrationDbClient, targetDbClient, mappedUserIds);
	console.log('Mapped tag IDs:', mappedTagIds);
	const mappedBookmarkIds = await migrateBookmarks(
		migrationDbClient,
		targetDbClient,
		mappedUserIds,
		mappedCategoryIds,
		mappedTagIds
	);
	console.log('Mapped bookmark IDs:', mappedBookmarkIds);
	const migratedImages = await migrateBookmarkImages(
		migrationDbClient,
		targetDbClient,
		mappedBookmarkIds,
		mappedUserIds,
		extractPath
	);
	console.log('Migrated images:', migratedImages);

	await deleteBackupFiles(backupPath, extractPath);

	return {
		count: {
			users: Object.keys(mappedUserIds).length,
			categories: Object.keys(mappedCategoryIds).length,
			tags: Object.keys(mappedTagIds).length,
			bookmarks: Object.keys(mappedBookmarkIds).length,
			images: migratedImages
		}
	};
}
