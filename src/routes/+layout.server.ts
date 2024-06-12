import type { LayoutServerLoad } from './$types';
import { db } from '$lib/database/db';
import { bookmarkSchema, categorySchema, tagSchema, userSchema } from '$lib/database/schema';
import { searchIndexKeys } from '$lib/utils/search';
import { serializeBookmarkList } from '$lib/utils/serialize-bookmark-list';
import { asc, count, desc, eq } from 'drizzle-orm';

import type { Category } from '$lib/types/Category.type';

import type { Bookmark } from '$lib/types/Bookmark.type';
import type { Tag } from '$lib/types/Tag.type';

export const load = (async ({ locals, url }) => {
	const noUsersFound = await db
		.select({ count: count(userSchema.id) })
		.from(userSchema)
		.then((r) => r[0].count === 0);

	if (!locals.user) {
		return {
			bookmarks: [] as Bookmark[],
			categories: [] as Category[],
			tags: [] as Tag[],
			noUsersFound,
			status: 401
		};
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '20');

	const [{ categories, tags }] = await db.query.userSchema.findMany({
		where: eq(userSchema.id, locals.user.id),
		with: {
			categories: {
				orderBy: desc(categorySchema.created),
				with: {
					parent: true
				}
			},
			tags: { orderBy: asc(tagSchema.name) }
		}
	});

	const bookmarksWithTagsQuery = await db.query.bookmarkSchema.findMany({
		limit,
		offset: (page - 1) * limit,
		where: eq(bookmarkSchema.ownerId, locals.user.id),
		orderBy: desc(bookmarkSchema.created),
		with: {
			bookmarksToTags: true,
			mainImage: true,
			icon: true,
			screenshot: true,
			category: {
				with: {
					parent: true
				}
			},
			owner: true
		}
	});

	const bookmarks = bookmarksWithTagsQuery.map((b) => {
		const { bookmarksToTags, ...bookmark } = b;

		return {
			...bookmark,
			tags: tags.filter((t) => bookmarksToTags.some((bt) => bt.tagId === t.id))
		};
	});

	const bookmarksCount = await db
		.select({ count: count() })
		.from(bookmarkSchema)
		.where(eq(bookmarkSchema.ownerId, locals.user!.id));

	const bookmarksForIndexQuery = await db.query.bookmarkSchema.findMany({
		with: {
			bookmarksToTags: {
				with: {
					tag: true
				}
			}
		},
		columns: {
			id: true,
			...searchIndexKeys.reduce((acc, key) => {
				acc[key] = true;
				return acc;
			}, {} as any)
		}
	});

	const bookmarksForIndex = bookmarksForIndexQuery.map((b) => {
		const { bookmarksToTags, ...bookmark } = b;

		return {
			...bookmark,
			tags: bookmarksToTags.map((bt) => bt.tag)
		};
	});

	return {
		bookmarks: serializeBookmarkList(bookmarks), // todo: provide URL's for local images
		categories,
		tags,
		bookmarksForIndex,
		bookmarksCount,
		page,
		limit
	};
}) satisfies LayoutServerLoad;
