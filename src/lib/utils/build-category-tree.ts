import type { Category } from '$lib/types/Category.type';

export function buildCategoryTree(
	categories: Category[],
	parent?: Category
): (Category & { children?: Category[] })[] {
	return categories
		.filter((c) => c.parent?.id === parent?.id)
		.map((c) => ({
			...c,
			children: buildCategoryTree(categories, c)
		}));
}
