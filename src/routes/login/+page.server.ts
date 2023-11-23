import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const data = await request.formData();
		const usernameOrEmail = data.get('usernameOrEmail') as string;
		const password = data.get('password') as string;

		try {
			const user = await locals.pb.collection('users').authWithPassword(usernameOrEmail, password);

			if (user.record.disabled) {
				return fail(401, {
					usernameOrEmail,
					password,
					disabled: true
				});
			}
		} catch (e) {
			console.error(e);

			return fail(401, {
				usernameOrEmail,
				password,
				incorrect: true
			});
		}

		throw redirect(303, '/');
	}
};
