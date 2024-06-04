import { relations, sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { FileSourceEnum, FileStorageTypeEnum } from '../enums/files';

import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
export const userSchema = sqliteTable(
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
		nameIdx: index('usert_name_index').on(table.name),
		emailIdx: index('usert_email_index').on(table.email)
	})
);

export const fileSchema = sqliteTable(
	'file',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		fileName: text('file_name'),
		storageType: text('storage_type', {
			enum: [FileStorageTypeEnum.Local, FileStorageTypeEnum.S3]
		}),
		relativePath: text('relative_path'),
		size: integer('size'),
		mimeType: text('mime-type'),
		source: text('source', {
			enum: [FileSourceEnum.Url, FileSourceEnum.Upload, FileSourceEnum.WebExtension]
		}),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => userSchema.id),
		created: integer('created', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
		updated: integer('updated', { mode: 'timestamp' }).$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
	},
	(table) => ({
		ownerIdIdx: index('filet_owner_id_index').on(table.ownerId)
	})
);

export const categorySchema = sqliteTable(
	'category',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name'),
		slug: text('slug'),
		description: text('description'),
		color: text('color'),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => userSchema.id),
		parentId: integer('parent_id').references((): AnySQLiteColumn => categorySchema.id),
		archived: integer('archived', { mode: 'timestamp' }),
		public: integer('public', { mode: 'timestamp' }),
		icon: text('icon'),
		initial: integer('initial', { mode: 'boolean' }),
		created: integer('created', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
		updated: integer('updated', { mode: 'timestamp' }).$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
	},
	(table) => ({
		userIdNameIdx: index('categoryt_user_name_index').on(table.ownerId, table.name),
		userIdSlugIdx: index('categoryt_user_slug_index').on(table.ownerId, table.slug)
	})
);

export const tagSchema = sqliteTable(
	'tag',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name'),
		slug: text('slug'),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => userSchema.id),
		created: integer('created', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
		updated: integer('updated', { mode: 'timestamp' }).$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
	},
	(table) => ({
		userIdNameIdx: index('tagt_user_name_index').on(table.ownerId, table.name),
		userIdSlugIdx: index('tagt_user_slug_index').on(table.ownerId, table.slug)
	})
);

export const bookmarkSchema = sqliteTable(
	'bookmark',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		url: text('url'),
		domain: text('domain'),
		title: text('title'),
		description: text('description'),
		author: text('author'),
		contentText: text('content_text'),
		contentHtml: text('content_html'),
		contentType: text('content_type'),
		contentPublishedDate: text('content_published_date'),
		note: text('note'),
		mainImageUrl: text('main_image_url'),
		mainImageId: integer('main_image').references(() => fileSchema.id),
		iconUrl: text('icon_url'),
		iconId: integer('icon').references(() => fileSchema.id),
		screenshot: integer('screenshot').references(() => fileSchema.id),
		importance: integer('importance'),
		flagged: integer('flagged', { mode: 'timestamp' }),
		read: integer('read', { mode: 'timestamp' }),
		archived: integer('archived', { mode: 'timestamp' }),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => userSchema.id),
		categoryId: integer('category_id')
			.notNull()
			.references(() => categorySchema.id),
		openedLast: integer('opened_last', { mode: 'timestamp' }),
		openedTimes: integer('opened_times').default(0),
		created: integer('created', { mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
		updated: integer('updated', { mode: 'timestamp' }).$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
	},
	(table) => ({
		urlOwnerIdx: index('bookmarkt_url_owner_index').on(table.url, table.ownerId),
		titleOwnerIdx: index('bookmarkt_title_owner_index').on(table.title, table.ownerId),
		domainOwnerIdx: index('bookmarkt_domain_owner_index').on(table.domain, table.ownerId),
		createdOwnerIdx: index('bookmarkt_created_owner_index').on(table.created, table.ownerId)
	})
);

// many-to-many tables
export const bookmarksToTagsSchema = sqliteTable(
	'bookmarks_to_tags',
	{
		bookmarkId: integer('bookmark_id')
			.notNull()
			.references(() => bookmarkSchema.id),
		tagId: integer('tag_id')
			.notNull()
			.references(() => tagSchema.id)
	},
	(table) => ({
		bookmarkId: index('bookmarks_to_tags_bookmark_id_index').on(table.bookmarkId),
		pk: primaryKey({ columns: [table.bookmarkId, table.tagId] })
	})
);

// relations
export const bookmarksRelations = relations(bookmarkSchema, ({ many }) => ({
	bookmarksToTags: many(bookmarksToTagsSchema)
}));

export const tagRelations = relations(tagSchema, ({ many }) => ({
	bookmarksToTags: many(bookmarksToTagsSchema)
}));

export const bookmarkToTagsRelations = relations(bookmarksToTagsSchema, ({ one }) => ({
	bookmark: one(bookmarkSchema, {
		fields: [bookmarksToTagsSchema.bookmarkId],
		references: [bookmarkSchema.id]
	}),
	tag: one(tagSchema, {
		fields: [bookmarksToTagsSchema.tagId],
		references: [tagSchema.id]
	})
}));

export const userRelationsSchema = relations(userSchema, ({ many }) => ({
	bookmarks: many(bookmarkSchema),
	categories: many(categorySchema),
	tags: many(tagSchema),
	files: many(fileSchema)
}));

export const categoryRelationsSchema = relations(categorySchema, ({ many, one }) => ({
	bookmarks: many(bookmarkSchema),
	parent: one(categorySchema, {
		fields: [categorySchema.parentId],
		references: [categorySchema.id]
	})
}));
