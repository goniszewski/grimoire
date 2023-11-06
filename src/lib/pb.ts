import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import PocketBase from 'pocketbase';
import { writable } from 'svelte/store';

export const pb = new PocketBase(PUBLIC_POCKETBASE_URL);

export const currentUser = writable(pb.authStore.model);
type adminAuth = {
	token: string;
	admin: {
		id: string;
		username: string;
		email: string;
		created: string;
		updated: string;
	};
};
export const currentAdmin = writable<adminAuth | null>(null);

currentAdmin.subscribe((admin) => {
	if (admin?.token) {
		setTimeout(
			() => {
				currentAdmin.set(null);
			},
			1000 * 60 * 60 * 24
		);
	}
});
