import type { LayoutServerLoad } from './$types';

import type { Category } from '$lib/interfaces/Category.interface';
import type { Tag } from 'sanitize-html';
import type { BookmarkDto } from '$lib/interfaces/dto/Bookmark.dto';
import { getFileUrl } from '$lib/utils';

export const load = (async ({ locals }) => {
	if (!locals.user) {
		return {
			bookmarks: [],
			categories: [],
			status: 401
		};
	}

	const categories = await locals.pb.collection('categories').getList<Category>(1, 1000, {
		filter: `owner = "${locals.user!.id}"`,
		sort: 'name'
	});

	const tags = await locals.pb.collection('tags').getList<Tag>(1, 1000, {
		filter: `owner = "${locals.user!.id}"`,
		sort: 'name'
	});

	const bookmarks = (await locals.pb.collection('bookmarks').getList(1, 50, {
		expand: 'tags,category',
		filter: `owner = "${locals.user!.id}"`,
		sort: '-created'
	})) as { items: BookmarkDto[] };

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
		categories: structuredClone(categories.items),
		tags: structuredClone(tags.items)
	};
}) satisfies LayoutServerLoad;
