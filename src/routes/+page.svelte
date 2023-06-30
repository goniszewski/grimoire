<script lang="ts">
	import AddBookmarkButton from '$lib/components/AddBookmarkButton/AddBookmarkButton.svelte';
	import AddBookmarkModal from '$lib/components/AddBookmarkModal/AddBookmarkModal.svelte';
	import BookmarkCard from '$lib/components/BookmarkCard/BookmarkCard.svelte';
	import BookmarkList from '$lib/components/BookmarksList/BookmarkList.svelte';
	import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';
</script>

<div class="m-8">
	<div class="ml-auto w-fit">
		<AddBookmarkButton />
	</div>
	<AddBookmarkModal />
	<EditBookmarkModal />
	<BookmarkList />
	<!-- <BookmarkCard /> -->
</div>
