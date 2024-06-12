import type { User } from './User.type';

export type Tag = {
	id: number;
	name: string;
	slug: string;
	ownerId: number;
	owner?: User | null;
	created: Date;
	updated: Date;
};
