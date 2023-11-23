/// <reference path="../pb_data/types.d.ts" />
migrate(
	(db) => {
		const collection = new Collection({
			id: 'g429v4jmri1976a',
			created: '2023-11-21 14:46:09.439Z',
			updated: '2023-11-21 14:46:09.439Z',
			name: 'tags',
			type: 'base',
			system: false,
			schema: [
				{
					system: false,
					id: 'kllkifiu',
					name: 'name',
					type: 'text',
					required: false,
					presentable: false,
					unique: false,
					options: {
						min: null,
						max: null,
						pattern: ''
					}
				},
				{
					system: false,
					id: '7uugm9ud',
					name: 'slug',
					type: 'text',
					required: false,
					presentable: false,
					unique: false,
					options: {
						min: null,
						max: null,
						pattern: ''
					}
				},
				{
					system: false,
					id: 'fkpxmodj',
					name: 'owner',
					type: 'relation',
					required: false,
					presentable: false,
					unique: false,
					options: {
						collectionId: '_pb_users_auth_',
						cascadeDelete: false,
						minSelect: null,
						maxSelect: 1,
						displayFields: []
					}
				}
			],
			indexes: ['CREATE INDEX `idx_KOjGTeA` ON `tags` (\n  `name`,\n  `owner`\n)'],
			listRule: '',
			viewRule: '',
			createRule: '',
			updateRule: '',
			deleteRule: '',
			options: {}
		});

		return Dao(db).saveCollection(collection);
	},
	(db) => {
		const dao = new Dao(db);
		const collection = dao.findCollectionByNameOrId('g429v4jmri1976a');

		return dao.deleteCollection(collection);
	}
);
