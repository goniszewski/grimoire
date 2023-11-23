/// <reference path="../pb_data/types.d.ts" />
migrate(
	(db) => {
		const dao = new Dao(db);
		const collection = dao.findCollectionByNameOrId('_pb_users_auth_');

		collection.indexes = ['CREATE INDEX `idx_x9VCIBo` ON `users` (`name`)'];

		// add
		collection.schema.addField(
			new SchemaField({
				system: false,
				id: 'jznryx0b',
				name: 'settings',
				type: 'json',
				required: false,
				presentable: false,
				unique: false,
				options: {}
			})
		);
		collection.schema.addField(
			new SchemaField({
				system: false,
				id: 'zfoaohpv',
				name: 'disabled',
				type: 'date',
				required: false,
				presentable: false,
				unique: false,
				options: {
					min: '',
					max: ''
				}
			})
		);

		return dao.saveCollection(collection);
	},
	(db) => {
		const dao = new Dao(db);
		const collection = dao.findCollectionByNameOrId('_pb_users_auth_');

		collection.indexes = [];

		// remove
		collection.schema.removeField('jznryx0b');

		return dao.saveCollection(collection);
	}
);
