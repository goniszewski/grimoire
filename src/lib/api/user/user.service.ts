import type { CreateUserDto } from './dto/create-user.dto';
import type PocketBase from 'pocketbase';
import type { UpdateUserDto } from './dto/update-user.dto';

export class UserService {
	constructor(private backend: PocketBase) {}

	async createUser(data: CreateUserDto) {
		const userData = {
			username: data.username,
			name: data.name,
			email: data.email,
			emailVisibility: true,
			password: data.password,
			passwordConfirm: data.passwordConfirm,
			avatar: data.avatar,
			is_admin: false
		};

		return this.backend.collection('users').create(userData);
	}

	async createAdmin(data: CreateUserDto) {
		const userData = {
			username: data.username,
			name: data.name,
			email: data.email,
			emailVisibility: true,
			password: data.password,
			passwordConfirm: data.passwordConfirm,
			avatar: data.avatar,
			is_admin: true
		};

		return this.backend.collection('users').create(userData);
	}

	async getUserById(id: string) {
		return this.backend.collection('users').getOne(id);
	}

	async getUserByUsername(username: string) {
		return this.backend.collection('users').getFirstListItem(`username="${username}"`);
	}

	async getUserByEmail(email: string) {
		return this.backend.collection('users').getFirstListItem(`email="${email}"`);
	}

	async updateUser(id: string, data: Partial<UpdateUserDto>) {
		return this.backend.collection('users').update(id, data);
	}

	async archiveUser(id: string) {
		return this.backend.collection('users').update(id, { archived: new Date() });
	}

	async unarchiveUser(id: string) {
		return this.backend.collection('users').update(id, { archived: null });
	}

	async deleteUser(id: string) {
		return this.backend.collection('users').delete(id);
	}
}
