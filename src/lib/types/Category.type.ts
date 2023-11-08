import type { User } from './User.type';

export type Category = {
	id: string;
	name: string;
	slug: string;
	icon: string | null;
	description: string;
	color: string;
	owner: User;
	parent: Category;
	archived: Date | null;
	public: Date | null;
	created: Date;
	updated: Date;
};
