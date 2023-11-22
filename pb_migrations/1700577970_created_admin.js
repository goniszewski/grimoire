/// <reference path="../pb_data/types.d.ts" />
migrate(
	(db) => {
		const dao = new Dao(db);
		const rootAdmin = new Admin();
		const rootAdminEmail = $os.getenv('ROOT_ADMIN_EMAIL') || 'admin@grimoire.localhost';
		const rootAdminPassword = $os.getenv('ROOT_ADMIN_PASSWORD') || 'changeme';

		rootAdmin.email = rootAdminEmail;
		rootAdmin.setPassword(rootAdminPassword);

		dao.saveAdmin(rootAdmin);
	},
	(db) => {
		const dao = new Dao(db);
		const rootAdminEmail = $os.getenv('ROOT_ADMIN_EMAIL') || 'admin@grimoire.localhost';

		const rootAdmin = dao.getAdminByEmail(rootAdminEmail);

		return dao.deleteAdmin(rootAdmin);
	}
);
