<script lang="ts">
	import { writable } from 'svelte/store';
	import AddBookmarkForm from '../AddBookmarkForm/AddBookmarkForm.svelte';
	import { onMount } from 'svelte/internal';

	const modal = writable<HTMLDialogElement>();

	onMount(() => {
		modal.set(document.getElementById('addBookmarkModal') as HTMLDialogElement);
	});

	function closeModal() {
		$modal.close();
	}
</script>

<dialog bind:this={$modal} id="addBookmarkModal" class="modal">
	<form method="dialog" class="modal-box max-w-full sm:max-w-screen-md md:max-w-screen-md">
		<h2 class="font-bold text-lg mb-4">Adding new bookmark</h2>
		<AddBookmarkForm {closeModal} />
	</form>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
