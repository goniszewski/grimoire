import type { UserSettings } from '../UserSettings.type';

export type UserDbo = {
	id: number;
	avatarId: number | null;
	email: string;
	name: string;
	settings: UserSettings;
	username: string;
	verified: boolean;
	disabled: Date | null;
	created: Date;
	updated: Date;
};
