import type { Category } from '$lib/interfaces/Category.interface';

export interface CreateCategoryDto
	extends Pick<Category, 'name' | 'description' | 'color' | 'public' | 'parent'> {}
