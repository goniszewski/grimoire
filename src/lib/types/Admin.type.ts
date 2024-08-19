import type { User } from './User.type';

export type AdminData = {
	users: UserOverview[];
	bookmarksTotalCount: number;
	backups: Backup[];
	settings: Settings;
};

export type SystemSettings = {
	llm: {
		provider: string;
		enabled: boolean;
		openai: {
			apiKey: string;
		};
		ollama: {
			url: string;
		};
	};
};

export type Settings = SystemSettings;

export type Backup = {
	key: string;
	modified: string;
	size: number;
};

export type Token = {
	secret: string;
	duration: number;
};

export type AuthProvider = {
	enabled: boolean;
	clientId: string;
	clientSecret: string;
	authUrl: string;
	tokenUrl: string;
	userApiUrl: string;
};

export type Backups = {
	cron: string;
	cronMaxKeep: number;
	s3: S3;
};

export type S3 = {
	enabled: boolean;
	bucket: string;
	region: string;
	endpoint: string;
	accessKey: string;
	secret: string;
	forcePathStyle: boolean;
};

export type EmailAuth = {
	enabled: boolean;
	exceptDomains: null;
	onlyDomains: null;
	minPasswordLength: number;
};

export type Logs = {
	maxDays: number;
};

export type Meta = {
	appName: string;
	appUrl: string;
	hideControls: boolean;
	senderName: string;
	senderAddress: string;
	verificationTemplate: Template;
	resetPasswordTemplate: Template;
	confirmEmailChangeTemplate: Template;
};

export type Template = {
	body: string;
	subject: string;
	actionUrl: string;
};

export type SMTP = {
	enabled: boolean;
	host: string;
	port: number;
	username: string;
	password: string;
	authMethod: string;
	tls: boolean;
	localName: string;
};

// export type User = {
// 	avatar: string;
// 	collectionId: string;
// 	collectionName: string;
// 	created: string;
// 	email: string;
// 	emailVisibility: boolean;
// 	id: string;
// 	name: string;
// 	updated: string;
// 	username: string;
// 	verified: boolean;
// 	bookmarksCount?: number;
// 	categoriesCount?: number;
// 	tagsCount?: number;
// };

export type UserOverview = {
	id: number;
	created: Date;
	username: string;
	email: string;
	disabled: Date | null;
} & {
	bookmarksCount?: number;
	categoriesCount?: number;
	tagsCount?: number;
};
