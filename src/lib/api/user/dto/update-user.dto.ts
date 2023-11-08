import type { User } from '$lib/types/User.type';

export interface UpdateUserDto
	extends Partial<Pick<User, 'username' | 'name' | 'email' | 'password' | 'avatar'>> {}
