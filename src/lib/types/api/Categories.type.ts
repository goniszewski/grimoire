import type { Category } from '../Category.type';

export type AddCategoryRequestBody = Partial<Omit<Category, 'id' | 'name'>> &
	Pick<Category, 'name'>;

export type UpdateCategoryRequestBody = Partial<Category> & Pick<Category, 'id'>;
