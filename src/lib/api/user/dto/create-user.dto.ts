import type { User } from '$lib/types/User.type';

export interface CreateUserDto
	extends Pick<User, 'username' | 'name' | 'email' | 'password' | 'avatar' | 'is_admin'> {
	passwordConfirm: string;
	emailVisibility: boolean;
}
