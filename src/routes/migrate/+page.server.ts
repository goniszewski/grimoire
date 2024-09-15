import { uploadBackupFile } from '$lib/utils/data-migration/download-migration-backup';
import { migrateData } from '$lib/utils/data-migration/migrate-data';

import type { Actions } from './$types';

export const actions: Actions = {
	useExistingBackupFile: async (event) => {
		const formData = await event.request.formData();
		const backup = formData.get('backup') as Blob;

		const filePath = await uploadBackupFile(backup);

		console.log('File path:', filePath);

		return {
			success: true,
			filePath
		};
	},

	runMigration: async (event) => {
		const formData = await event.request.formData();
		const backupFilePath = formData.get('backupFilePath') as string;

		const result = await migrateData(backupFilePath);

		console.log('Migration result:', result);

		return {
			success: true,
			result
		};
	}
};
