import type { LayoutServerLoad } from './$types';

import type { Category } from '$lib/interfaces/Category.interface';
import type { Tag } from '$lib/interfaces/Tag.interface';
import type { BookmarkDto } from '$lib/interfaces/dto/Bookmark.dto';
import type { CategoryDto } from '$lib/interfaces/dto/Category.dto';
import { getFileUrl } from '$lib/utils';

import type { TagWithBookmarks } from '$lib/interfaces/dto/Tag.dto';

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

export const load = (async ({ locals }) => {
	if (!locals.user) {
		return {
			bookmarks: [] as BookmarkDto[],
			categories: [] as Category[],
			tags: [] as TagWithBookmarks[],
			status: 401
		};
	}

	const categories = (await locals.pb.collection('categories').getList(1, 1000, {
		expand: 'parent',
		filter: `owner = "${locals.user!.id}"`,
		sort: 'name'
	})) as { items: CategoryDto[] };

	const tags = await locals.pb.collection('tags').getList<Tag>(1, 1000, {
		filter: `owner = "${locals.user!.id}"`,
		sort: 'name'
	});

	const bookmarks = (await locals.pb.collection('bookmarks').getList(1, 50, {
		expand: 'tags,category',
		filter: `owner = "${locals.user!.id}"`,
		sort: '-created'
	})) as { items: BookmarkDto[] };

	const tagsWithBookmarks = tagWithBookmarkIds(bookmarks.items, tags.items);

	console.log(JSON.stringify(categories, null, 2));
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
		tags: structuredClone(tagsWithBookmarks)
	};
}) satisfies LayoutServerLoad;
