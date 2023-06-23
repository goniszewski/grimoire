<script lang="ts">
	import AddBookmarkButton from '$lib/components/AddBookmarkButton/AddBookmarkButton.svelte';
	import AddBookmarkModal from '$lib/components/AddBookmarkModal/AddBookmarkModal.svelte';
	import Bookmark from '$lib/components/Bookmark/Bookmark.svelte';
	import type { Category } from '$lib/interfaces/Category.interface';
	import type { PageData } from './$types';

	export let pageData: PageData;
</script>

<div class="m-8">
	<div class="ml-auto w-fit">
		<AddBookmarkButton />
	</div>
	<AddBookmarkModal />
	<Bookmark />
</div>
