import type { User } from './User.type';

export type Category = {
	id: number;
	name: string;
	slug: string;
	icon: string | null;
	description: string | null;
	color: string | null;
	ownerId: number;
	owner?: User | null;
	parentId: number | null;
	parent?: Category | null;
	archived: Date | null;
	public: Date | null;
	initial: boolean;
	created: Date;
	updated: Date;
};
