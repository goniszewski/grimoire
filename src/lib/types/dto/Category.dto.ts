import type { Category } from '../Category.type';

export type CategoryDto = Category & {
	expand?: {
		parent?: Category;
	};
};
