import { currentUser, pb } from '$lib/pb';
import { userSettingsStore } from '$lib/stores/user-settings.store';

pb.authStore.loadFromCookie(document.cookie);
pb.authStore.onChange(() => {
	currentUser.set(pb.authStore.model);
	document.cookie = pb.authStore.exportToCookie({ httpOnly: false });

	if (pb.authStore.model?.settings) {
		userSettingsStore.set(pb.authStore.model.settings);
	}
});
