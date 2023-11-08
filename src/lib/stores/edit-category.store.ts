import type { Category } from '$lib/types/Category.type';
import { writable } from 'svelte/store';

export const editCategoryStore = writable<Partial<Category>>({});
