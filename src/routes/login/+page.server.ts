import { handlePBError } from '$lib/pb';

import { error, fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';
export const actions: Actions = {
	default: async ({ locals, request }) => {
		const data = await request.formData();
		const usernameOrEmail = data.get('usernameOrEmail') as string;
		const password = data.get('password') as string;

		if (!usernameOrEmail || !password) {
			return fail(400, {
				usernameOrEmail: !usernameOrEmail,
				password: !password,
				missing: true
			});
		}

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
			return handlePBError(e, locals.pb, true);
		}

		throw redirect(303, '/');
	}
};
