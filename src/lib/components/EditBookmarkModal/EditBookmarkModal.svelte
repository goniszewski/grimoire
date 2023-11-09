<script lang="ts">
	import EditBookmarkForm from '../EditBookmarkForm/EditBookmarkForm.svelte';
	import { editBookmarkStore as bookmark } from '$lib/stores/edit-bookmark.store';
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';

	const modal = writable<HTMLDialogElement>();

	onMount(() => {
		modal.set(document.getElementById('editBookmarkModal') as HTMLDialogElement);
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

<dialog bind:this={$modal} id="editBookmarkModal" class="modal">
	<form method="dialog" class="modal-box max-w-full sm:max-w-screen-md md:max-w-screen-md">
		<button
			type="button"
			on:click={closeModal}
			class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button
		>
		<h2 class="font-bold text-lg mb-4">Edit bookmark</h2>
		<EditBookmarkForm {closeModal} />
	</form>
	<!-- <form method="dialog" class="modal-backdrop"> -->
	<button class="modal-backdrop" on:click={() => closeModal()}>close</button>
	<!-- </form> -->
</dialog>
