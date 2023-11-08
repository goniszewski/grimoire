import type { User } from './User.type';

export type Tag = {
	id: string;
	name: string;
	slug: string;
	owner: User;
	created: Date;
	updated: Date;
};
