import {
    BookmarkRelations, getBookmarksByCategoryIds
} from '$lib/database/repositories/Bookmark.repository';

import type { Category } from '$lib/types/Category.type';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, parent }) => {
	if (!locals.user) {
		return {
			bookmarks: []
		};
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '20');

	const categorySlug = url.pathname.split('/')[2];
	const { categories } = await parent();

	const category = categories.find((c) => c.slug === categorySlug);

	const getIdsOfCategoryAndChildren = (categories: Category[], slug: string): number[] => {
		const category = categories.find((c) => c.slug === slug);
		if (!category) return [];
		const children = categories.filter((c) => c.parent?.id === category.id);
		return [
			category.id,
			...children.flatMap((c) => getIdsOfCategoryAndChildren(categories, c.slug))
		];
	};

	const nestedCategoryIds = getIdsOfCategoryAndChildren(categories, categorySlug);

	const relatedBookmarks = await getBookmarksByCategoryIds(nestedCategoryIds, locals.user!.id, [
		BookmarkRelations.CATEGORY__PARENT,
		BookmarkRelations.TAGS__TAG
	]);

	return {
		category,
		bookmarks: relatedBookmarks,
		page,
		limit
	};
};
