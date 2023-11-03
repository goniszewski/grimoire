import type { Category } from '$lib/interfaces/Category.interface';
import { writable } from 'svelte/store';

export const editCategoryStore = writable<Partial<Category>>({});
