import type { Tag } from "$lib/interfaces/Tag.interface";

export interface CreateTagDto extends Pick<Tag, "name" | "color" > {}