import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const bookmarks = sqliteTable('bookmarks', {
	id: text('id')
		.primaryKey()
		.notNull()
		.default(sql`('r'||lower(hex(randomblob(7))))`),
	archived: text('archived').notNull().default(''),
	author: text('author').notNull().default(''),
	category: text('category').notNull().default(''),
	contentHtml: text('content_html').notNull().default(''),
	contentText: text('content_text').notNull().default(''),
	contentType: text('content_type').notNull().default(''),
	created: text('created')
		.notNull()
		.default(sql`(strftime('%Y-%m-%d %H:%M:%fZ'))`),
	description: text('description').notNull().default(''),
	domain: text('domain').notNull().default(''),
	flagged: text('flagged').notNull().default(''),
	icon: text('icon').notNull().default(''),
	iconUrl: text('icon_url').notNull().default(''),
	importance: integer('importance').notNull().default(0),
	mainImage: text('main_image').notNull().default(''),
	mainImageUrl: text('main_image_url').notNull().default(''),
	note: text('note').notNull().default(''),
	openedLast: text('opened_last').notNull().default(''),
	openedTimes: integer('opened_times').notNull().default(0),
	owner: text('owner').notNull().default(''),
	read: text('read').notNull().default(''),
	tags: text('tags', { mode: 'json' }).notNull().default('[]').$type<string[]>(),
	title: text('title').notNull().default(''),
	updated: text('updated')
		.notNull()
		.default(sql`(strftime('%Y-%m-%d %H:%M:%fZ'))`),
	url: text('url').notNull().default(''),
	screenshot: text('screenshot').notNull().default('')
});

export const categories = sqliteTable('categories', {
	id: text('id')
		.primaryKey()
		.notNull()
		.default(sql`('r'||lower(hex(randomblob(7))))`),
	archived: text('archived').notNull().default(''),
	color: text('color').notNull().default(''),
	created: text('created')
		.notNull()
		.default(sql`(strftime('%Y-%m-%d %H:%M:%fZ'))`),
	description: text('description').notNull().default(''),
	icon: text('icon').notNull().default(''),
	initial: integer('initial', { mode: 'boolean' }).notNull().default(false),
	name: text('name').notNull().default(''),
	owner: text('owner').notNull().default(''),
	parent: text('parent').notNull().default(''),
	public: text('public').notNull().default(''),
	slug: text('slug').notNull().default(''),
	updated: text('updated')
		.notNull()
		.default(sql`(strftime('%Y-%m-%d %H:%M:%fZ'))`)
});

export const tags = sqliteTable('tags', {
	id: text('id')
		.primaryKey()
		.notNull()
		.default(sql`('r'||lower(hex(randomblob(7))))`),
	created: text('created')
		.notNull()
		.default(sql`(strftime('%Y-%m-%d %H:%M:%fZ'))`),
	name: text('name').notNull().default(''),
	owner: text('owner').notNull().default(''),
	slug: text('slug').notNull().default(''),
	updated: text('updated')
		.notNull()
		.default(sql`(strftime('%Y-%m-%d %H:%M:%fZ'))`)
});

export const users = sqliteTable('users', {
	id: text('id')
		.primaryKey()
		.notNull()
		.default(sql`('r'||lower(hex(randomblob(7))))`),
	avatar: text('avatar').notNull().default(''),
	created: text('created')
		.notNull()
		.default(sql`(strftime('%Y-%m-%d %H:%M:%fZ'))`),
	email: text('email').notNull().default(''),
	emailVisibility: integer('emailVisibility', { mode: 'boolean' }).notNull().default(false),
	lastResetSentAt: text('lastResetSentAt').notNull().default(''),
	lastVerificationSentAt: text('lastVerificationSentAt').notNull().default(''),
	name: text('name').notNull().default(''),
	passwordHash: text('passwordHash').notNull(),
	tokenKey: text('tokenKey').notNull(),
	updated: text('updated')
		.notNull()
		.default(sql`(strftime('%Y-%m-%d %H:%M:%fZ'))`),
	username: text('username').notNull(),
	verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
	settings: text('settings', { mode: 'json' }),
	disabled: text('disabled').notNull().default('')
});
