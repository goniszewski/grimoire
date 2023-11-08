import type { Tag } from '$lib/types/Tag.type';

export interface CreateTagDto extends Pick<Tag, 'name' | 'color'> {}
