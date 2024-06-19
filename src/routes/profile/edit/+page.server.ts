import type { Actions } from '../../$types';
import { updateUser } from '$lib/database/repositories/User.repository';
import joi from 'joi';

import { hash } from '@node-rs/argon2';
import { fail } from '@sveltejs/kit';

import type { User } from '$lib/types/User.type';
type UpdatedUserInfo = Partial<
	Pick<User, 'name' | 'email' | 'username'> & {
		current_password: string;
		new_password: string;
		new_password_repeat: string;
	}
>;

export const actions = {
	default: async ({ locals, request }) => {
		const owner = locals.user?.id;

		if (!owner) {
			return fail(401, {
				error: 'Unauthorized'
			});
		}

		const data = await request.formData();
		const updatedUserInfo = Object.fromEntries(data.entries()) as UpdatedUserInfo;

		if (
			(updatedUserInfo.current_password ||
				updatedUserInfo.new_password ||
				updatedUserInfo.new_password_repeat) &&
			!(
				updatedUserInfo.current_password &&
				updatedUserInfo.new_password &&
				updatedUserInfo.new_password_repeat
			)
		) {
			return fail(400, {
				error: 'Please provide all password fields',
				missing: true
			});
		}

		const validationSchema = joi.object<UpdatedUserInfo>({
			name: joi.string().optional(),
			email: joi.string().allow('').email().optional(),
			username: joi.string().optional(),
			current_password: joi.string().optional(),
			new_password: joi.string().min(8).optional(),
			new_password_repeat: joi.string().min(8).optional()
		});

		const { error } = validationSchema.validate(updatedUserInfo);

		if (error) {
			console.error('Error validating user input. Details:', JSON.stringify(error, null, 2));
			return fail(400, {
				error: error.message,
				incorrect: true
			});
		}

		try {
			let passwordHash: string | undefined;
			if (updatedUserInfo.new_password) {
				passwordHash = await hash(updatedUserInfo.new_password, {
					// recommended minimum parameters
					memoryCost: 19456,
					timeCost: 2,
					outputLen: 32,
					parallelism: 1
				});
			}

			const updatedUser = await updateUser(owner, {
				...(updatedUserInfo.name && { name: updatedUserInfo.name }),
				...(updatedUserInfo.email && { email: updatedUserInfo.email }),
				...(updatedUserInfo.username && { username: updatedUserInfo.username }),
				...(passwordHash && { passwordHash })
			}).catch((err) => {
				console.error('Error updating user settings. Details:', JSON.stringify(err, null, 2));

				throw err;
			});

			return {
				updatedUser
			};
		} catch (e: any) {
			return fail(500, {
				error: e.message
			});
		}
	}
} satisfies Actions;
