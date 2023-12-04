import config from '$lib/config';
import { defaultUser, handlePBError } from '$lib/pb';

import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';

export const load = async () => {
	return {
		signupDisabled: config.SIGNUP_DISABLED
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const data = await request.formData();

		const username = data.get('username') as string;
		const name = data.get('name') as string;
		const email = data.get('email') as string;
		const password = data.get('password') as string;
		const passwordConfirm = data.get('passwordConfirm') as string;

		if (!username || !password || !passwordConfirm) {
			return fail(400, {
				username: !username,
				password: !password,
				passwordConfirm: !passwordConfirm,
				missing: true
			});
		}

		try {
			await locals.pb
				.collection('users')
				.create({ ...defaultUser, username, name, email, password, passwordConfirm });

			const { record: user } = await locals.pb
				.collection('users')
				.authWithPassword(username, password);

			await locals.pb.collection('categories').create({
				owner: user.id,
				name: 'Uncategorized',
				description: 'Default category for uncategorized bookmarks',
				color: '#808080',
				initial: true
			});
		} catch (e: any) {
			return handlePBError(e, locals.pb, true);
		}

		throw redirect(303, '/');
	}
};
