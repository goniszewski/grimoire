import type { Tag } from '$lib/types/Tag.type';

export interface UpdateTagDto extends Partial<Pick<Tag, 'name' | 'color'>> {}
