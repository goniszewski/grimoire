import type Fuse from 'fuse.js';
import { writable } from 'svelte/store';

export const searchedValue = writable('');
export const searchEngine = writable<Fuse<any>>();
