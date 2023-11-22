/// <reference path="../pb_data/types.d.ts" />
migrate(
	(db) => {
		const dao = new Dao(db);
		const settings = dao.findSettings();

		settings.meta.appName = 'Grimoire';

		return dao.saveSettings(settings);
	},
	(db) => {
		return;
	}
);
