import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

const BACKUP_NAME = 'pb_migration.zip';
async function authenticateAdmin(adminEmail: string, adminPassword: string, pbUrl: string): Promise<string> {
	const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: adminEmail, password: adminPassword })
	});
	const authData = (await authResponse.json()) as {
		token: string;
	};
	return authData.token;
}

async function createBackup(token: string, pbUrl: string): Promise<void> {
	const {ok, statusText} = await fetch(`${pbUrl}/api/backups`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ name: BACKUP_NAME })
	});
	
	if (!ok) {
		console.error('Failed to create backup:', statusText);
	}
}

async function downloadBackup(backupKey: string, token: string, pbUrl: string): Promise<ArrayBuffer> {
	const downloadResponse = await fetch(`${pbUrl}/api/backups/${backupKey}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	return await downloadResponse.arrayBuffer();
}

async function saveBackupFile(backupZip: ArrayBuffer): Promise<string> {
	const backupDir = path.join(process.cwd(), 'data', 'temp');
	if (!fs.existsSync(backupDir)) {
		fs.mkdirSync(backupDir);
	}
	const backupPath = path.join(backupDir, `migration_backup_${Date.now()}.zip`);
	fs.writeFileSync(backupPath, Buffer.from(backupZip));

	return backupPath;
}

export async function createAndDownloadBackup(adminEmail: string, adminPassword: string, pbUrl: string) {
	const token = await authenticateAdmin(adminEmail, adminPassword, pbUrl);
	await createBackup(token, pbUrl);
	const backupZip = await downloadBackup(BACKUP_NAME, token, pbUrl);
	const backupPath = await saveBackupFile(backupZip);

	return backupPath;
}

