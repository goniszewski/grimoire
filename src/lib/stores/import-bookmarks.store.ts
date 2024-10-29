import { derived, writable } from 'svelte/store';

import type { BulkListItem } from '$lib/types/common/BulkList.type';

const store = writable<BulkListItem[]>([]);
const { subscribe, set, update } = store;

export const importBookmarkStore = {
	subscribe,
	set,
	update,
	addItem: (item: BulkListItem) => update((items) => [...items, item]),
	removeItem: (itemId: number) => update((items) => items.filter((item) => item.id !== itemId)),
	selectItem: (itemId: number) =>
		update((items) => items.map((item) => ({ ...item, selected: item.id === itemId }))),
	isAnySelected: derived(store, (items) => items.some((item) => item.selected)),
	toggleSelectionForItem: (itemId: number) =>
		update((items) =>
			items.map((item) => ({
				...item,
				selected: item.id === itemId ? !item.selected : item.selected
			}))
		),
	setSelectStatusForAll: (selected: boolean) =>
		update((items) => items.map((item) => ({ ...item, selected }))),
	removeSelected: () => update((items) => items.filter((item) => !item.selected)),
	length: derived(store, (items) => items.length)
};
