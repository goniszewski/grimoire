import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const data = await request.formData();
		const usernameOrEmail = data.get('usernameOrEmail') as string;
		const password = data.get('password') as string;

		try {
			await locals.pb.admins.authWithPassword(usernameOrEmail, password);
		} catch (e) {
			console.error(e);

			return fail(401, {
				usernameOrEmail,
				password,
				invalid: true
			});
		}

		throw redirect(303, '/admin/');
	}
} satisfies Actions;
