import type { Category } from '$lib/types/Category.type';

export interface UpdateCategoryDto
	extends Partial<Pick<Category, 'name' | 'description' | 'color' | 'parent'>> {}
