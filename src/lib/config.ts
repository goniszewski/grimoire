export default {
	BACKEND_URL: process.env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090',
	POCKETBASE_URL: process.env.PUBLIC_POCKETBASE_URL || 'http://pocketbase:80',
	HTTPS_ONLY: process.env.HTTPS_ONLY === 'true' || false
};
