import type PocketBase from 'pocketbase';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

export class CategoryService {
	constructor(private backend: PocketBase) {}

	async createCategory(data: CreateCategoryDto, owner: string) {
		const categoryData = {
			name: data.name,
			color: data.color,
			public: data.public,
			parent: data.parent,
			owner
		};

		return this.backend.collection('categories').create(categoryData);
	}

	async updateCategory(id: string, data: Partial<UpdateCategoryDto>) {
		return this.backend.collection('categories').update(id, data);
	}

	async getCategoryById(id: string) {
		return this.backend.collection('categories').getOne(id);
	}

	async getCategoryByName(name: string, owner: string) {
		return this.backend
			.collection('categories')
			.getFirstListItem(`name="${name}" AND owner="${owner}"`);
	}

	async getCategoriesByOwner(owner: string) {
		return this.backend.collection('categories').getFirstListItem(`owner="${owner}"`, {
			sort: 'name'
		});
	}

	async getCategoryPath(id: string) {
		const category = await this.backend.collection('categories').getOne(id);
		const path = [category];
		let parent = category.parent;

		while (parent) {
			const parentCategory = await this.backend.collection('categories').getOne(parent);
			path.unshift(parentCategory);
			parent = parentCategory.parent;
		}
		return path;
	}

	getCategoriesByParent(parent: string) {
		return this.backend.collection('categories').getFirstListItem(`parent="${parent}"`, {
			sort: 'name'
		});
	}

	async getCategoriesHierarchy(owner: string) {
		const categories = await this.backend
			.collection('categories')
			.getList(1, 10000, {
				filter: `owner="${owner}"`,
				fields: 'id,name,parent,archived,public'
			})
			.then((res) => res.items);

		const categoriesMap = new Map<string, any>();

		for (const category of categories) {
			categoriesMap.set(category.id, category);
		}

		const hierarchy = [];

		for (const category of categories) {
			if (category.parent) {
				const parent = categoriesMap.get(category.parent);

				if (!parent.children) {
					parent.children = [];
				}

				parent.children.push(category);
			} else {
				hierarchy.push(category);
			}
		}

		return hierarchy;
	}

	async markCategoryAsArchived(id: string) {
		return this.backend.collection('categories').update(id, { archived: new Date() });
	}

	async markCategoryAsNotArchived(id: string) {
		return this.backend.collection('categories').update(id, { archived: null });
	}

	async markCategoryAsPublic(id: string) {
		return this.backend.collection('categories').update(id, { public: new Date() });
	}

	async markCategoryAsNotPublic(id: string) {
		return this.backend.collection('categories').update(id, { public: null });
	}

	async deleteCategory(id: string) {
		return this.backend.collection('categories').delete(id);
	}
}
