import { pb, user } from '$lib/pb';
import { userSettingsStore } from '$lib/stores/user-settings.store';

import type { User } from '$lib/types/User.type';
import type { BaseAuthStore } from 'pocketbase';

pb.authStore.loadFromCookie(document.cookie);
pb.authStore.onChange(() => {
	user.set(
		pb.authStore as BaseAuthStore & {
			model: User;
		}
	);
	document.cookie = pb.authStore.exportToCookie({ httpOnly: false });

	if (pb.authStore.model?.settings) {
		userSettingsStore.set(pb.authStore.model.settings);
	}
}, true);
