import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

const BACKUP_NAME = 'pb_migration.zip';
async function authenticateAdmin(
	pbUrl: string,
	adminEmail: string,
	adminPassword: string
): Promise<string> {
	const authResponse = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identity: adminEmail, password: adminPassword })
	});

	if (!authResponse.ok) {
		throw new Error(`PB admin authentication failed: ${authResponse.statusText}`);
	}
	const response = await authResponse.json();

	const { token } = response as {
		token: string;
	};

	return token;
}

async function createBackup(token: string, pbUrl: string): Promise<string> {
	const { ok, statusText } = await fetch(`${pbUrl}/api/backups`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!ok) {
		throw new Error(`Failed to request backup creation: ${statusText}`);
	}

	const listBackupsResponse = await fetch(`${pbUrl}/api/backups`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});
	const backups = (await listBackupsResponse.json()) as {
		key: string;
		modified: string;
		size: number;
	}[];

	if (!backups.length) {
		throw new Error('No backups found in PB.');
	}

	const lastBackupKey = backups.sort((a, b) => {
		const dateA = new Date(a.modified);
		const dateB = new Date(b.modified);
		return dateB.getTime() - dateA.getTime();
	})[0].key;

	return lastBackupKey;
}

async function downloadBackup(
	pbUrl: string,
	backupKey: string,
	token: string
): Promise<ArrayBuffer> {
	const fileTokenResponse = await fetch(`${pbUrl}/api/files/token`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!fileTokenResponse.ok) {
		throw new Error(`Failed to get file token: ${fileTokenResponse.statusText}`);
	}
	const fileToken = (await fileTokenResponse.json()) as {
		token: string;
	};
	const downloadResponse = await fetch(
		`${pbUrl}/api/backups/${encodeURIComponent(backupKey)}?token=${fileToken.token}`,
		{
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` }
		}
	);
	if (!downloadResponse.ok) {
		throw new Error(`Failed to download backup: ${downloadResponse.statusText}`);
	}
	const backupZip = await downloadResponse.arrayBuffer();

	return backupZip;
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

export async function createAndDownloadBackup(
	pbUrl: string,
	adminEmail: string,
	adminPassword: string
) {
	const pbUrlWithoutTrailingSlash = pbUrl.replace(/\/$/, '');

	const token = await authenticateAdmin(pbUrlWithoutTrailingSlash, adminEmail, adminPassword);
	const backupKey = await createBackup(token, pbUrl);
	const backupZip = await downloadBackup(pbUrlWithoutTrailingSlash, backupKey, token);
	const backupPath = await saveBackupFile(backupZip);

	return backupPath;
}

export async function uploadBackupFile(backupFile: Blob) {
	const arrayBuffer = await backupFile.arrayBuffer();
	const backupPath = await saveBackupFile(arrayBuffer);

	return backupPath;
}
