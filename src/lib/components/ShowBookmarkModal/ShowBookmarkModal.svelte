<script lang="ts">
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';

	import { showBookmarkStore as bookmark } from '$lib/stores/show-bookmark.store';
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';
	import ShowBookmarkContent from '../ShowBookmarkContent/ShowBookmarkContent.svelte';

	const modal = writable<HTMLDialogElement>();

	onMount(() => {
		modal.set(document.getElementById('showBookmarkModal') as HTMLDialogElement);
	});

	$: {
		if ($bookmark?.id) {
			$modal.showModal();
		}
	}

	function closeModal() {
		bookmark.set({});

		$modal.close();
	}
</script>

<dialog bind:this={$modal} id="showBookmarkModal" class="modal">
	<form method="dialog" class="modal-box max-w-full sm:max-w-screen-md md:max-w-screen-md">
		<button
			type="button"
			on:click={closeModal}
			class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button
		>
		<h2 class="font-bold text-lg mb-4">Bookmark details</h2>
		<ShowBookmarkContent {closeModal} />
	</form>
	<!-- <form method="dialog" class="modal-backdrop"> -->
	<button class="modal-backdrop" on:click={() => closeModal()}>close</button>
	<!-- </form> -->
</dialog>
