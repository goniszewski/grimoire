import type { UserDbo } from './UserDbo.type';

export type CategoryDbo = {
	id: number;
	name: string;
	slug: string;
	icon: string | null;
	description: string | null;
	color: string | null;
	ownerId: number;
	owner?: UserDbo | null;
	parentId: number | null;
	parent?: CategoryDbo | null;
	archived: Date | null;
	public: Date | null;
	initial: boolean;
	created: Date;
	updated: Date;
};
