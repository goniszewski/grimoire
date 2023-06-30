import type { User } from './User.interface';

export interface Tag {
	id: string;
	name: string;
	owner: User;
	created: Date;
	updated: Date;
}
