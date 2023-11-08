import type { Category } from '$lib/types/Category.type';

export interface CreateCategoryDto
	extends Pick<Category, 'name' | 'description' | 'color' | 'public' | 'parent'> {}
