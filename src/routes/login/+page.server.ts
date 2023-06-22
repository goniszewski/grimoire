import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const data = Object.fromEntries(await request.formData()) as {
			usernameOrEmail: string;
			password: string;
		};

		try {
			await locals.pb.collection('users').authWithPassword(data.usernameOrEmail, data.password);
		} catch (e) {
			console.error(e);
			throw e;
		}

		throw redirect(303, '/');
	}
};
