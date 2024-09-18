import type { PageServerLoad } from '../$types';

type Contributor = {
	login: string;
	id: number;
	node_id: string;
	avatar_url: string;
	gravatar_id: string;
	url: string;
	html_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	starred_url: string;
	subscriptions_url: string;
	organizations_url: string;
	repos_url: string;
	events_url: string;
	received_events_url: string;
	type: string;
	site_admin: boolean;
	contributions: number;
};

export const load: PageServerLoad = async () => {
	const response = await fetch('https://api.github.com/repos/goniszewski/grimoire/contributors');
	const contributors = await response
		.json()
		.then((data:Contributor[]) =>
			data.filter(
				(contributor) => contributor.type === 'User' && contributor.login !== 'goniszewski'
            )
            .sort((a, b) => b.contributions - a.contributions).splice(0, 10))

	return {
		contributors
	};
};
