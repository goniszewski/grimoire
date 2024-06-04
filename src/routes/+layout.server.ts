import type { LayoutServerLoad } from './$types';
import { db } from '$lib/database/db';
import { bookmarkSchema, categorySchema, tagSchema, userSchema } from '$lib/database/schema';
import { searchIndexKeys } from '$lib/utils/search';
import { serializeBookmarkList } from '$lib/utils/serialize-bookmark-list';
import { and, asc, count, desc, eq } from 'drizzle-orm';

import type { Category } from '$lib/types/Category.type';
import type { Tag } from '$lib/types/Tag.type';
import type { BookmarkDto } from '$lib/types/dto/Bookmark.dto';

import type { TagWithBookmarks } from '$lib/types/dto/Tag.dto';
function tagWithBookmarkIds(bookmarks: BookmarkDto[], tags: Tag[]): TagWithBookmarks[] {
	return tags.map((tag) => {
		const tagBookmarks = bookmarks.reduce((acc, bookmark) => {
			if (bookmark.expand?.tags?.find((t) => t.id === tag.id)) {
				acc.push(bookmark.id);
			}
			return acc;
		}, [] as string[]);

		return {
			...tag,
			bookmarks: tagBookmarks
		};
	});
}

export const load = (async ({ locals, url }) => {
	const noUsersFound = await locals.pb
		.collection('users')
		.getList(1, 1, {
			fields: 'collectionName',
			requestKey: null,
			headers: {
				RequestFor: 'user-count'
			}
		})
		.then((res) => res.totalItems === 0)
		.catch(() => true);

	if (!locals.user) {
		return {
			bookmarks: [] as BookmarkDto[],
			categories: [] as Category[],
			tags: [] as TagWithBookmarks[],
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
			bookmarksToTags: true
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

	const bookmarksForIndex = await locals.pb
		.collection('bookmarks')
		.getFullList({
			fields: 'id,' + searchIndexKeys.join(','),
			expand: 'tags',
			filter: `owner.id="${locals.user!.id}"`,
			batchSize: 100000,
			requestKey: `bookmarksForIndex-${locals.user!.id}`
		})
		.then((res) =>
			res.map(({ expand, ...b }) => ({
				...expand,
				...b
			}))
		);
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
