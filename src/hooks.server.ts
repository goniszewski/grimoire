import { pb } from '$lib/pb';

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');
	if (pb.authStore.isValid) {
		try {
			if(event.url.pathname.startsWith('/admin')) {
				await pb.admins.authRefresh().then((res) => {
					console.log('pb.admins.authRefresh', res,pb.authStore.model, pb.authStore.isAdmin);
				}
				);
			} else {
				await pb.collection('users').authRefresh().then((res) => {
					console.log('pb.collection(users).authRefresh', res,pb.authStore.model);
				}
				);
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
