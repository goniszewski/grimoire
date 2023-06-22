// import type { Actions } from './$types';
// import { getMetadata } from '$lib/utils';

// export const actions = {
// 	fetchMetadata: async ({ request }) => {
// 		const data = await request.formData();
// 		const url = data.get('url') as string;

// 		console.log({ url });

// 		const metadata = await getMetadata(url);

// 		return {
// 			success: true,
// 			body: metadata
// 		};
// 	}
// } satisfies Actions;
