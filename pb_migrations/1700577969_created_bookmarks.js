/// <reference path="../pb_data/types.d.ts" />
migrate(
	(db) => {
		const collection = new Collection({
			id: 'mwhpoxiiau7d76n',
			created: '2023-11-21 14:46:09.438Z',
			updated: '2023-11-21 14:46:09.438Z',
			name: 'bookmarks',
			type: 'base',
			system: false,
			schema: [
				{
					system: false,
					id: 'tbdk5qxb',
					name: 'domain',
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
					id: 'cqbv1mrs',
					name: 'title',
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
					id: '1mt0mjw6',
					name: 'description',
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
					id: 'f44hamhv',
					name: 'author',
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
					id: 'vhe4uuyf',
					name: 'content_text',
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
					id: 'pxliw2oi',
					name: 'content_html',
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
					id: '1gidamar',
					name: 'content_type',
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
					id: 'pn5rr7t1',
					name: 'note',
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
					id: 'ywiflrvg',
					name: 'main_image',
					type: 'file',
					required: false,
					presentable: false,
					unique: false,
					options: {
						maxSelect: 1,
						maxSize: 5242880,
						mimeTypes: [],
						thumbs: [],
						protected: false
					}
				},
				{
					system: false,
					id: '19kdr5xp',
					name: 'main_image_url',
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
					id: 'geq9lf9j',
					name: 'icon',
					type: 'file',
					required: false,
					presentable: false,
					unique: false,
					options: {
						maxSelect: 1,
						maxSize: 5242880,
						mimeTypes: [],
						thumbs: [],
						protected: false
					}
				},
				{
					system: false,
					id: 'gz6ou7xg',
					name: 'icon_url',
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
					id: '6inuqkcr',
					name: 'importance',
					type: 'number',
					required: false,
					presentable: false,
					unique: false,
					options: {
						min: null,
						max: null,
						noDecimal: false
					}
				},
				{
					system: false,
					id: 'e9bofzda',
					name: 'flagged',
					type: 'date',
					required: false,
					presentable: false,
					unique: false,
					options: {
						min: '',
						max: ''
					}
				},
				{
					system: false,
					id: 'avqdwivw',
					name: 'read',
					type: 'date',
					required: false,
					presentable: false,
					unique: false,
					options: {
						min: '',
						max: ''
					}
				},
				{
					system: false,
					id: 'cx7qw8iu',
					name: 'archived',
					type: 'date',
					required: false,
					presentable: false,
					unique: false,
					options: {
						min: '',
						max: ''
					}
				},
				{
					system: false,
					id: 'qv6xnl05',
					name: 'category',
					type: 'relation',
					required: false,
					presentable: false,
					unique: false,
					options: {
						collectionId: 'mjw5ghnwcd8v16o',
						cascadeDelete: false,
						minSelect: null,
						maxSelect: 1,
						displayFields: []
					}
				},
				{
					system: false,
					id: 'uwhixub1',
					name: 'tags',
					type: 'relation',
					required: false,
					presentable: false,
					unique: false,
					options: {
						collectionId: 'g429v4jmri1976a',
						cascadeDelete: false,
						minSelect: null,
						maxSelect: null,
						displayFields: []
					}
				},
				{
					system: false,
					id: 'h8fwfjtc',
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
				},
				{
					system: false,
					id: 'rq2w5xh5',
					name: 'opened_last',
					type: 'date',
					required: false,
					presentable: false,
					unique: false,
					options: {
						min: '',
						max: ''
					}
				},
				{
					system: false,
					id: 'zgh1hm7m',
					name: 'opened_times',
					type: 'number',
					required: false,
					presentable: false,
					unique: false,
					options: {
						min: null,
						max: null,
						noDecimal: false
					}
				},
				{
					system: false,
					id: 'hohdpatd',
					name: 'url',
					type: 'url',
					required: false,
					presentable: false,
					unique: false,
					options: {
						exceptDomains: [],
						onlyDomains: []
					}
				}
			],
			indexes: [
				'CREATE INDEX `idx_C7bh0dH` ON `bookmarks` (\n  `url`,\n  `owner`\n)',
				'CREATE INDEX `idx_kpPVzhA` ON `bookmarks` (\n  `title`,\n  `owner`\n)',
				'CREATE INDEX `idx_UclYjMo` ON `bookmarks` (\n  `created`,\n  `owner`\n)'
			],
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
		const collection = dao.findCollectionByNameOrId('mwhpoxiiau7d76n');

		return dao.deleteCollection(collection);
	}
);
