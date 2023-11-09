import { pb, user } from '$lib/pb';

import type { User } from '$lib/types/User.type';

import type { Handle } from '@sveltejs/kit';
import type { BaseAuthStore } from 'pocketbase';

export const handle: Handle = async ({ event, resolve }) => {
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');
	if (pb.authStore.isValid) {
		try {
			if (event.url.pathname.startsWith('/admin')) {
				await pb.admins.authRefresh().then((res) => {
					console.info('Admin logged:', res?.admin.email);
					user.set(
						pb.authStore as BaseAuthStore & {
							model: User;
						}
					);
				});
			} else {
				await pb
					.collection('users')
					.authRefresh()
					.then((res) => {
						console.info('User logged:', res.record.username);
					});
			}
		} catch (_) {
			pb.authStore.clear();
		}
	}

	event.locals.pb = pb;
	event.locals.user = structuredClone(pb.authStore.model);

	const response = await resolve(event);

	response.headers.set('set-cookie', pb.authStore.exportToCookie({ httpOnly: false }));

	return response;
};
