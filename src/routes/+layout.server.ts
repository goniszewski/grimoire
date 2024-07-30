import type { LayoutServerLoad } from './$types';
import { db } from '$lib/database/db';
import {
	fetchBookmarkCountByUserId,
	getBookmarksByUserId
} from '$lib/database/repositories/Bookmark.repository';
import { fetchUserCategoryAndTags, getUserCount } from '$lib/database/repositories/User.repository';
import { searchIndexKeys } from '$lib/utils/search';

import type { Category } from '$lib/types/Category.type';

import type { Bookmark, BookmarkForIndex } from '$lib/types/Bookmark.type';
import type { Tag } from '$lib/types/Tag.type';
export const load = (async ({ locals, url }) => {
	const userCount = await getUserCount();
	const noUsersFound = userCount === 0;

	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '20');

	if (!locals.user) {
		return {
			bookmarks: [] as Bookmark[],
			categories: [] as Category[],
			tags: [] as Tag[],
			bookmarksForIndex: [] as BookmarkForIndex[],
			noUsersFound,
			user: null,
			status: 401,
			page,
			limit
		};
	}

	const { categories, tags } = await fetchUserCategoryAndTags(locals.user.id);
	const bookmarks = await getBookmarksByUserId(locals.user.id, {
		page,
		limit,
		orderBy: 'created',
		orderDirection: 'desc'
	});
	console.log({ bookmark: bookmarks[0].tags });
	const bookmarksCount = await fetchBookmarkCountByUserId(locals.user.id);

	const bookmarksForIndexQuery = await db.query.bookmarkSchema.findMany({
		with: {
			tags: {
				with: {
					tag: true
				}
			},
			category: true
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
		const { tags, ...bookmark } = b;

		return {
			...bookmark,
			tags: tags.map((bt) => bt.tag),
			category: b.category
		};
	}) as BookmarkForIndex[];

	return {
		bookmarks,
		categories,
		tags,
		bookmarksForIndex,
		bookmarksCount,
		user: locals.user,
		page,
		limit
	};
}) satisfies LayoutServerLoad;
