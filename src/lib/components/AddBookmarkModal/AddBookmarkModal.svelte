<script lang="ts">
	import AddBookmarkForm from '../AddBookmarkForm/AddBookmarkForm.svelte';
</script>

<dialog id="addBookmarkModal" class="modal">
	<form method="dialog" class="modal-box max-w-full sm:max-w-screen-md md:max-w-screen-md">
		<h2 class="font-bold text-lg mb-4">Adding new bookmark</h2>
		<AddBookmarkForm />
	</form>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
