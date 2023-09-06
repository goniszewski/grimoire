import Fuse from 'fuse.js';

const defaultOptions = {
	includeScore: true,
	shouldSort: true,
	threshold: 0.3,
	keys: [
		{
			name: 'title',
			weight: 0.7
		},
		{
			name: 'domain',
			weight: 0.5
		},
		{
			name: 'description',
			weight: 0.3
		},
		{
			name: 'url',
			weight: 0.2
		},
		{
			name: 'tags.name',
			weight: 0.2
		}
	]
};

export const searchFactory = (data: any[], options: Fuse.IFuseOptions<any> = {}) => {
	const fuse = new Fuse(data, { ...defaultOptions, ...options });

	return fuse;
};
