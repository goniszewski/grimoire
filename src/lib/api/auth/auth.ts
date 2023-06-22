import type PocketBase from 'pocketbase';

export class Auth {
	constructor(private backend: PocketBase) {}

	async login(usernameOrEmail: string, password: string) {
		return this.backend.collection('users').authWithPassword(usernameOrEmail, password);
	}

	async logout() {
		return this.backend.authStore.clear();
	}

	async register(username: string, email: string, password: string, passwordConfirm: string) {
		return this.backend.collection('users').create({
			username,
			email,
			password,
			passwordConfirm
		});
	}
}
