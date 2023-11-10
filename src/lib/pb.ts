import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { writable } from 'svelte/store';

import type { User } from './types/User.type';

export const pb = new PocketBase(PUBLIC_POCKETBASE_URL);

export const user = writable(
	pb.authStore as BaseAuthStore & {
		model: User;
	}
);

export const currentUser = writable(pb.authStore.model);
