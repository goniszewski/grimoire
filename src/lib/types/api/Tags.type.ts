import type { Tag } from '../Tag.type';

export type AddTagRequestBody = Partial<Omit<Tag, 'id' | 'name'>> & Pick<Tag, 'name'>;
