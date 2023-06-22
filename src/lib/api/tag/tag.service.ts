// create TagService based on UserService
import type PocketBase from 'pocketbase';

import type { CreateTagDto } from './dto/create-tag.dto';
import type { UpdateTagDto } from './dto/update-tag.dto';

export class TagService {
	constructor(private backend: PocketBase) {}

	async createTag(data: CreateTagDto, owner: string) {
		const tagData = {
			name: data.name,
			color: data.color,
			owner
		};

		return this.backend.collection('tags').create(tagData);
	}

	async updateTag(id: string, data: Partial<UpdateTagDto>) {
		return this.backend.collection('tags').update(id, data);
	}

	async getTagById(id: string) {
		return this.backend.collection('tags').getOne(id);
	}

	async getTagByName(name: string, owner: string) {
		return this.backend.collection('tags').getFirstListItem(`name="${name}" AND owner="${owner}"`);
	}

	async getTagsByOwner(owner: string) {
		return this.backend.collection('tags').getFirstListItem(`owner="${owner}"`, {
			sort: 'name'
		});
	}

	async deleteTag(id: string) {
		return this.backend.collection('tags').delete(id);
	}
}
