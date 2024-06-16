import type { UserDbo } from './UserDbo.type';

export type TagDbo = {
	id: number;
	name: string;
	slug: string;
	ownerId: number;
	owner?: UserDbo | null;
	created: Date;
	updated: Date;
};
