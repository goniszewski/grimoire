import { env } from '$env/dynamic/public';

const getProcessEnvValue = (key: string) =>
	typeof process === 'object' ? process.env[key] : undefined;

export default {
	BACKEND_URL:
		env.PUBLIC_POCKETBASE_URL ||
		getProcessEnvValue('PUBLIC_POCKETBASE_URL') ||
		'http://localhost:8090',
	POCKETBASE_URL:
		env.PUBLIC_POCKETBASE_URL ||
		getProcessEnvValue('PUBLIC_POCKETBASE_URL') ||
		'http://pocketbase:80',
	HTTPS_ONLY:
		(env.PUBLIC_HTTPS_ONLY || getProcessEnvValue('PUBLIC_HTTPS_ONLY')) === 'true' || false,
	SIGNUP_DISABLED:
		(env.PUBLIC_SIGNUP_DISABLED || getProcessEnvValue('PUBLIC_SIGNUP_DISABLED')) === 'true' ||
		false,
	ORIGIN: env.PUBLIC_ORIGIN || getProcessEnvValue('PUBLIC_ORIGIN') || 'http://localhost:5173'
};
