import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

enum FileTypeEnum {
	Image = 'image',
	Video = 'video',
	Audio = 'audio',
	Document = 'document'
}

enum FileStorageTypeEnum {
	Local = 'local',
	S3 = 's3'
}

enum FileSourceEnum {
	Url = 'url',
	Upload = 'upload',
	WebExtension = 'web_extension'
}

export const user = sqliteTable(
	'user',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').unique(),
		email: text('email').unique(),
		avatar: integer('avatar'),
		settings: text('settings', { mode: 'json' }),
		disabled: integer('disabled', { mode: 'timestamp' }),
		created: integer('created', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
		updated: integer('updated', { mode: 'timestamp' }).$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
	},
	(table) => ({
		nameIdx: index('name_index').on(table.name),
		emailIdx: index('email_index').on(table.email)
	})
);

export const file = sqliteTable(
	'file',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		fileName: text('file_name'),
		storageType: text('storage_type', {
			enum: [FileStorageTypeEnum.Local, FileStorageTypeEnum.S3]
		}),
		relativePath: text('relative_path'),
		size: integer('size'),
		type: text('type', {
			enum: [FileTypeEnum.Image, FileTypeEnum.Video, FileTypeEnum.Audio, FileTypeEnum.Document]
		}),
		source: text('source', {
			enum: [FileSourceEnum.Url, FileSourceEnum.Upload, FileSourceEnum.WebExtension]
		}),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => user.id),
		created: integer('created', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
		updated: integer('updated', { mode: 'timestamp' }).$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
	},
	(table) => ({
		ownerIdIdx: index('owner_id_index').on(table.ownerId)
	})
);

export const category = sqliteTable(
	'category',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name'),
		slug: text('slug'),
		description: text('description'),
		color: text('color'),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => user.id),
		parentId: integer('parent_id').references((): AnySQLiteColumn => category.id),
		archived: integer('archived', { mode: 'timestamp' }),
		public: integer('public', { mode: 'timestamp' }),
		icon: text('icon'),
		initial: integer('initial', { mode: 'boolean' })
	},
	(table) => ({
		userIdNameIdx: index('user_name_index').on(table.ownerId, table.name),
		userIdSlugIdx: index('user_slug_index').on(table.ownerId, table.slug)
	})
);

export const tag = sqliteTable(
	'tag',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name'),
		slug: text('slug'),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => user.id),
		created: integer('created', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`)
	},
	(table) => ({
		userIdNameIdx: index('user_name_index').on(table.ownerId, table.name),
		userIdSlugIdx: index('user_slug_index').on(table.ownerId, table.slug)
	})
);

export const bookmark = sqliteTable(
	'bookmark',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		url: text('url'),
		domain: text('domain'),
		title: text('title'),
		description: text('description'),
		author: text('author'),
		content_text: text('content_text'),
		content_html: text('content_html'),
		content_type: text('content_type'),
		note: text('note'),
		mainImageUrl: text('main_image_url'),
		mainImage: integer('main_image').references(() => file.id),
		iconUrl: text('icon_url'),
		icon: integer('icon').references(() => file.id),
		screenshot: integer('screenshot').references(() => file.id),
		importance: integer('importance'),
		flagged: integer('flagged', { mode: 'timestamp' }),
		read: integer('read', { mode: 'timestamp' }),
		archived: integer('archived', { mode: 'timestamp' }),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => user.id),
		categoryId: integer('category_id')
			.notNull()
			.references(() => category.id),
		openedLast: integer('opened_last', { mode: 'timestamp' }),
		openedTimes: integer('opened_times').default(0),
		created: integer('created', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
		updated: integer('updated', { mode: 'timestamp' })
	},
	(table) => ({
		urlOwnerIdx: index('url_owner_index').on(table.url, table.ownerId),
		titleOwnerIdx: index('title_owner_index').on(table.title, table.ownerId),
		domainOwnerIdx: index('domain_owner_index').on(table.domain, table.ownerId),
		createdOwnerIdx: index('created_owner_index').on(table.created, table.ownerId)
	})
);

// many-to-many tables
export const bookmarksToTags = sqliteTable('bookmarks_to_tags', {
	bookmarkId: integer('bookmark_id')
		.notNull()
		.references(() => bookmark.id),
	tagId: integer('tag_id')
		.notNull()
		.references(() => tag.id)
});

// relations
export const bookmarksToTagsRelations = relations(bookmarksToTags, ({ many }) => ({
	bookmark: many(bookmark),
	tag: many(tag)
}));
export const userRelations = relations(user, ({ many }) => ({
	bookmarks: many(bookmark),
	categories: many(category),
	tags: many(tag),
	files: many(file)
}));

export const categoryRelations = relations(category, ({ many }) => ({
	bookmarks: many(bookmark)
}));
