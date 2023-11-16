import type { UserSettings } from './UserSettings.type';

export type User = {
	avatar: string;
	created: string;
	email: string;
	emailVisibility?: boolean;
	id: string;
	name: string;
	settings: UserSettings;
	updated: string;
	username: string;
	verified: boolean;
};
