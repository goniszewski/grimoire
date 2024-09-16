import {
    createAndDownloadBackup, uploadBackupFile
} from '$lib/utils/data-migration/download-migration-backup';
import { DEFAULT_USER_PASSWORD, migrateData } from '$lib/utils/data-migration/migrate-data';

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

	connectToPb: async (event) => {
		const formData = await event.request.formData();
		const pbUrl = formData.get('pbUrl') as string;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		console.log('connectToPb', {
			pbUrl,
			email,
			password
		});

		const filePath = await createAndDownloadBackup(pbUrl, email, password);

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
			result,
			userPassword: DEFAULT_USER_PASSWORD
		};
	}
};
