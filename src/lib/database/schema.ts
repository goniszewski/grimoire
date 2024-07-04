import { relations, sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { FileSourceEnum, FileStorageTypeEnum } from '../enums/files';

import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { UserSettings } from '$lib/types/UserSettings.type';
export const userSchema = sqliteTable(
	'user',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		username: text('username').unique().notNull(),
		email: text('email').unique().notNull(),
		passwordHash: text('password_hash').notNull(),
		avatarId: integer('avatar_id'),
		settings: text('settings', { mode: 'json' }).default('{}').notNull().$type<UserSettings>(),
		verified: integer('initial', { mode: 'boolean' }).default(false).notNull(),
		disabled: integer('disabled', { mode: 'timestamp' }),
		isAdmin: integer('is_admin', { mode: 'boolean' }).default(false).notNull(),
		created: integer('created', { mode: 'timestamp' })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),
		updated: integer('updated', { mode: 'timestamp' })
			.$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
			.notNull()
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
		fileName: text('file_name').notNull(),
		storageType: text('storage_type', {
			enum: [FileStorageTypeEnum.Local, FileStorageTypeEnum.S3]
		}).notNull(),
		relativePath: text('relative_path').notNull(),
		size: integer('size'),
		mimeType: text('mime-type').notNull(),
		source: text('source', {
			enum: [FileSourceEnum.Url, FileSourceEnum.Upload, FileSourceEnum.WebExtension]
		}).notNull(),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => userSchema.id, { onDelete: 'cascade' }),
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
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description'),
		color: text('color'),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => userSchema.id, { onDelete: 'cascade' }),
		parentId: integer('parent_id').references((): AnySQLiteColumn => categorySchema.id),
		archived: integer('archived', { mode: 'timestamp' }),
		public: integer('public', { mode: 'timestamp' }),
		icon: text('icon'),
		initial: integer('initial', { mode: 'boolean' }).default(false).notNull(),
		created: integer('created', { mode: 'timestamp' })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),
		updated: integer('updated', { mode: 'timestamp' })
			.$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
			.notNull()
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
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => userSchema.id, { onDelete: 'cascade' }),
		created: integer('created', { mode: 'timestamp' })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),
		updated: integer('updated', { mode: 'timestamp' })
			.$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
			.notNull()
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
		url: text('url').notNull(),
		domain: text('domain').notNull(),
		title: text('title').notNull(),
		description: text('description'),
		author: text('author'),
		contentText: text('content_text'),
		contentHtml: text('content_html'),
		contentType: text('content_type'),
		contentPublishedDate: text('content_published_date'),
		note: text('note'),
		mainImageUrl: text('main_image_url'),
		mainImageId: integer('main_image_id').references(() => fileSchema.id),
		iconUrl: text('icon_url'),
		iconId: integer('icon_id').references(() => fileSchema.id),
		screenshotId: integer('screenshotId').references(() => fileSchema.id),
		importance: integer('importance'),
		flagged: integer('flagged', { mode: 'timestamp' }),
		read: integer('read', { mode: 'timestamp' }),
		archived: integer('archived', { mode: 'timestamp' }),
		ownerId: integer('owner_id')
			.notNull()
			.references(() => userSchema.id, { onDelete: 'cascade' }),
		categoryId: integer('category_id')
			.notNull()
			.references(() => categorySchema.id),
		openedLast: integer('opened_last', { mode: 'timestamp' }),
		openedTimes: integer('opened_times').default(0).notNull(),
		created: integer('created', { mode: 'timestamp' })
			.default(sql`(CURRENT_TIMESTAMP)`)
			.notNull(),
		updated: integer('updated', { mode: 'timestamp' })
			.$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
			.notNull()
	},
	(table) => ({
		urlOwnerIdx: index('bookmarkt_url_owner_index').on(table.url, table.ownerId),
		titleOwnerIdx: index('bookmarkt_title_owner_index').on(table.title, table.ownerId),
		domainOwnerIdx: index('bookmarkt_domain_owner_index').on(table.domain, table.ownerId),
		createdOwnerIdx: index('bookmarkt_created_owner_index').on(table.created, table.ownerId)
	})
);

// auth
export const sessionSchema = sqliteTable('session', {
	id: text('id').notNull().primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => userSchema.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull()
});

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
export const bookmarksRelations = relations(bookmarkSchema, ({ many, one }) => ({
	bookmarksToTags: many(bookmarksToTagsSchema),
	mainImage: one(fileSchema, {
		fields: [bookmarkSchema.mainImageId],
		references: [fileSchema.id],
		relationName: 'mainImage'
	}),
	icon: one(fileSchema, {
		fields: [bookmarkSchema.iconId],
		references: [fileSchema.id],
		relationName: 'icon'
	}),
	screenshot: one(fileSchema, {
		fields: [bookmarkSchema.screenshotId],
		references: [fileSchema.id],
		relationName: 'screenshot'
	}),
	category: one(categorySchema, {
		fields: [bookmarkSchema.categoryId],
		references: [categorySchema.id],
		relationName: 'userCategories'
	}),
	owner: one(userSchema, {
		fields: [bookmarkSchema.ownerId],
		references: [userSchema.id],
		relationName: 'userBookmarks'
	})
}));

export const tagRelations = relations(tagSchema, ({ many, one }) => ({
	bookmarksToTags: many(bookmarksToTagsSchema, {
		relationName: 'bookmarks'
	}),
	owner: one(userSchema, {
		fields: [tagSchema.ownerId],
		references: [userSchema.id],
		relationName: 'userTags'
	})
}));

export const bookmarkToTagsRelations = relations(bookmarksToTagsSchema, ({ one }) => ({
	bookmark: one(bookmarkSchema, {
		fields: [bookmarksToTagsSchema.bookmarkId],
		references: [bookmarkSchema.id],
		relationName: 'bookmarks'
	}),
	tag: one(tagSchema, {
		fields: [bookmarksToTagsSchema.tagId],
		references: [tagSchema.id],
		relationName: 'tags'
	})
}));

export const fileRelationsSchema = relations(fileSchema, ({ many, one }) => ({
	owner: one(userSchema, {
		fields: [fileSchema.ownerId],
		references: [userSchema.id],
		relationName: 'userFiles'
	})
}));

export const userRelationsSchema = relations(userSchema, ({ many }) => ({
	bookmarks: many(bookmarkSchema, {
		relationName: 'userBookmarks'
	}),
	categories: many(categorySchema, {
		relationName: 'userCategories'
	}),
	tags: many(tagSchema, {
		relationName: 'userTags'
	}),
	files: many(fileSchema, {
		relationName: 'userFiles'
	})
}));

export const categoryRelationsSchema = relations(categorySchema, ({ many, one }) => ({
	bookmarks: many(bookmarkSchema),
	parent: one(categorySchema, {
		fields: [categorySchema.parentId],
		references: [categorySchema.id],
		relationName: 'children'
	}),
	owner: one(userSchema, {
		fields: [categorySchema.ownerId],
		references: [userSchema.id],
		relationName: 'userCategories'
	})
}));