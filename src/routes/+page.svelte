<script lang="ts">
	import AddBookmarkButton from '$lib/components/AddBookmarkButton/AddBookmarkButton.svelte';
	import AddBookmarkModal from '$lib/components/AddBookmarkModal/AddBookmarkModal.svelte';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';
	import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';

	import { page } from '$app/stores';
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';

	let bookmarks: Bookmark[] = [];

	$: {
		bookmarks = $page.data.bookmarks;
	}
</script>

<div>
	<div class="ml-auto w-fit m-4">
		<AddBookmarkButton />
	</div>
	<AddBookmarkModal />
	<EditBookmarkModal />
	<BookmarkList {bookmarks} />
</div>
