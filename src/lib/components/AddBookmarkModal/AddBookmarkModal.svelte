<script lang="ts">
	import AddBookmarkForm from '../AddBookmarkForm/AddBookmarkForm.svelte';
</script>

<dialog id="addBookmarkModal" class="modal w-auto">
	<form method="dialog" class="modal-box">
		<h3 class="font-bold text-lg">Hello!</h3>
		<AddBookmarkForm />
	</form>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
