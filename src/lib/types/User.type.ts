import type { UserSettings } from './UserSettings.type';

// export type User = {
// 	id: string;
// 	username: string;
// 	name: string;
// 	email: string;
// 	password: string;
// 	avatar: string;
// 	is_admin: boolean;
// 	archived: Date;
// 	seen_last: Date;
// 	created: Date;
// 	updated: Date;
// };

export type User = {
	avatar: string;
	collectionId: string;
	collectionName: string;
	created: string;
	email: string;
	emailVisibility: boolean;
	id: string;
	name: string;
	settings?: UserSettings;
	updated: string;
	username: string;
	verified: boolean;
};
