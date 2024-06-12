import { serializeBookmarkList } from '$lib/utils/serialize-bookmark-list';

export const load = async ({ locals, url, parent }) => {
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

	const getIdsOfCategoryAndChildren = (categories: CategoryDto[], slug: string): string[] => {
		const category = categories.find((c) => c.slug === slug);
		if (!category) return [];
		const children = categories.filter((c) => c.parent?.id === category.id);
		return [
			category.id,
			...children.flatMap((c) => getIdsOfCategoryAndChildren(categories, c.slug))
		];
	};

	const nestedCategoryIds = getIdsOfCategoryAndChildren(categories, categorySlug);

	const relatedBookmarks = (await locals.pb
		.collection('bookmarks')
		.getList(page, limit, {
			expand: 'tags,category',
			filter: `(${nestedCategoryIds.map((id) => `category.id="${id}"`).join('||')} && owner.id="${locals.user!.id}")`,
			sort: '-created',
			requestKey: `related-bookmarks-${categorySlug}`
		})
		.then((res) => res.items)) as BookmarkDto[];

	return {
		category,
		bookmarks: serializeBookmarkList(relatedBookmarks),
		page,
		limit
	};
};
