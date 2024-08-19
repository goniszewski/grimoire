import type { UserSettings } from './UserSettings.type';

export type User = {
	id: number;
	avatarId: number | null;
	email: string;
	name: string;
	settings: UserSettings;
	username: string;
	verified: boolean;
	disabled: Date | null;
	isAdmin: boolean;
	created: Date;
	updated: Date;
};

export type UserWithoutSerialization = User & {
	passwordHash: string;
};
