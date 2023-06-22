import type { Category } from "$lib/interfaces/Category.interface";

export interface UpdateCategoryDto extends Partial<Pick<Category, "name" | "description" | "color" | "parent">> {}