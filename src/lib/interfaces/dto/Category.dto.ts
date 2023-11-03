import type { Category } from '../Category.interface';

export interface CategoryDto extends Category {
	expand?: Partial<{
		parent: Category;
	}>;
}
