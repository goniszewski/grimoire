import type { Tag } from "$lib/interfaces/Tag.interface";

export interface UpdateTagDto extends Partial<Pick<Tag, "name" | "color" >> {}