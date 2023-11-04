<script lang="ts">
	import AddCategoryForm from '../AddCategoryForm/AddCategoryForm.svelte';
	import { addCategoryStore as category } from '$lib/stores/add-category.store';
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';

	const modal = writable<HTMLDialogElement>();

	onMount(() => {
		modal.set(document.getElementById('addCategoryModal') as HTMLDialogElement);
	});

	$: {
		if ($category?.id) {
			$modal.showModal();
		}
	}

	function closeModal() {
		category.set({});

		$modal.close();
	}
</script>

<dialog bind:this={$modal} id="addCategoryModal" class="modal">
	<form method="dialog" class="modal-box max-w-full sm:max-w-screen-md md:max-w-screen-md">
		<button
			type="button"
			on:click={closeModal}
			class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button
		>
		<h2 class="font-bold text-lg mb-4">Add category</h2>
		<AddCategoryForm {closeModal} />
	</form>
	<!-- <form method="dialog" class="modal-backdrop"> -->
	<button class="modal-backdrop" on:click={() => closeModal()}>close</button>
	<!-- </form> -->
</dialog>
