import type { Metadata } from '../Metadata.type';

export type BulkListItem = Partial<Metadata> & {
	id: number;
	icon: string;
	url: string;
	title: string;
	category: string;
	selected: boolean;
};
