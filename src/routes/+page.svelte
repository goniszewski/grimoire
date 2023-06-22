<script lang="ts">
	import AddBookmarkButton from '$lib/components/AddBookmarkButton/AddBookmarkButton.svelte';
	import AddBookmarkModal from '$lib/components/AddBookmarkModal/AddBookmarkModal.svelte';
	import Bookmark from '$lib/components/Bookmark/Bookmark.svelte';
	// import type { PageData, ActionData } from './$types';

	// export let form: ActionData;
</script>

<div class="m-8">
	<AddBookmarkButton />
	<AddBookmarkModal />
	<Bookmark />

	<!-- {#if form}
		<pre>{JSON.stringify(form, null, 2)}</pre>
	{/if} -->
</div>
