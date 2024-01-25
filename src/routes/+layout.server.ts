import type { LayoutServerLoad } from './$types';

import type { Category } from '$lib/types/Category.type';
import type { Tag } from '$lib/types/Tag.type';
import type { BookmarkDto } from '$lib/types/dto/Bookmark.dto';
import type { CategoryDto } from '$lib/types/dto/Category.dto';
import { getFileUrl } from '$lib/utils';
import { searchIndexKeys } from '$lib/utils/search';

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

	const categories = await locals.pb.collection('categories').getList<CategoryDto>(1, 1000, {
		expand: 'parent',
		filter: `owner="${locals.user!.id}"`,
		sort: 'name'
	});

	const tags = await locals.pb.collection('tags').getList<Tag>(1, 1000, {
		filter: `owner="${locals.user!.id}"`,
		sort: 'name',
		requestKey: `tags-${locals.user!.id}`
	});
	const bookmarks = await locals.pb.collection('bookmarks').getList<BookmarkDto>(page, limit, {
		expand: 'tags,category',
		filter: `owner="${locals.user!.id}"`,
		sort: '-created'
	});

	const bookmarksCount = await locals.pb
		.collection('bookmarks')
		.getList(1, 1, {
			filter: `owner="${locals.user!.id}"`,
			count: true,
			requestKey: `bookmarksCount-${locals.user!.id}`
		})
		.then((res) => res.totalItems);

	const tagsWithBookmarks = tagWithBookmarkIds(bookmarks.items, tags.items);

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
		bookmarks: structuredClone(
			bookmarks.items.map((bookmark) => ({
				// TODO: export this logic to a function
				...bookmark,
				icon: getFileUrl('bookmarks', bookmark.id, bookmark.icon),
				main_image: getFileUrl('bookmarks', bookmark.id, bookmark.main_image),
				...bookmark.expand
			}))
		),
		categories: structuredClone(
			categories.items.map((category) => ({ ...category, ...category.expand }))
		),
		tags: structuredClone(tagsWithBookmarks),
		bookmarksForIndex,
		bookmarksCount,
		page,
		limit
	};
}) satisfies LayoutServerLoad;
