import { defaultUser } from '$lib/pb';

import { redirect } from '@sveltejs/kit';

import type { Actions } from './$types';
export const actions: Actions = {
	default: async ({ locals, request }) => {
		const data = Object.fromEntries(await request.formData()) as {
			username: string;
			email: string;
			password: string;
			passwordConfirm: string;
		};

		try {
			await locals.pb.collection('users').create({ ...defaultUser, ...data });
			await locals.pb.collection('users').authWithPassword(data.username, data.password);

			await locals.pb.collection('categories').create({
				owner: locals.user!.id,
				name: 'Uncategorized',
				description: 'Default category for uncategorized bookmarks',
				color: '#808080',
				initial: true
			});
		} catch (e) {
			console.error(e);
			throw e;
		}

		throw redirect(303, '/');
	}
};
