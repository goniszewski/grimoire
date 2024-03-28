<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { page } from '$app/stores';
	import AddBookmarkModal from '$lib/components/AddBookmarkModal/AddBookmarkModal.svelte';
	import AddCategoryModal from '$lib/components/AddCategoryModal/AddCategoryModal.svelte';
	import CategoryTree from '$lib/components/CategoryTree/CategoryTree.svelte';
	import EditBookmarkModal from '$lib/components/EditBookmarkModal/EditBookmarkModal.svelte';
	import EditCategoryModal from '$lib/components/EditCategoryModal/EditCategoryModal.svelte';
	import Footer from '$lib/components/Footer/Footer.svelte';
	import ShowBookmarkModal from '$lib/components/ShowBookmarkModal/ShowBookmarkModal.svelte';
	import ThemeSwitch from '$lib/components/ThemeSwitch/ThemeSwitch.svelte';
	import { checkPocketbaseConnection, pb, user } from '$lib/pb';
	import { searchedValue } from '$lib/stores/search.store';
	import type { Category } from '$lib/types/Category.type';
	import { ToastNode, showToast } from '$lib/utils/show-toast';
	import { IconMenu, IconX } from '@tabler/icons-svelte';
	import { onDestroy, onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import '../app.css';
	import { env } from '$env/dynamic/public';

	let checkPbConnectionInterval: NodeJS.Timeout;
	let isPocketbaseAvailable: boolean;

	onMount(async () => {
		$user.loadFromCookie(document.cookie);

		isPocketbaseAvailable = await checkPocketbaseConnection();

		checkPbConnectionInterval = setInterval(async () => {
			isPocketbaseAvailable = await checkPocketbaseConnection();

			if (!isPocketbaseAvailable) {
				showToast.error('Could not connect to Pocketbase. Is it running?');
			}
		}, 10_000);
	});

	onDestroy(() => {
		clearInterval(checkPbConnectionInterval);
	});

	const categoriesTree = writable<(Category & { children?: Category[] })[] | []>([]);

	$: {
		const categories = $page.data.categories;
		const categoriesTreeData = categories
			.filter((c) => !c.parent)
			.map((c) => ({
				...c,
				children: categories
					.filter((c2) => c2.parent?.id === c.id)
					.map((c2) => ({
						...c2
					}))
			}));
		categoriesTree.set(categoriesTreeData);
	}
</script>

<div class="flex min-h-screen flex-col">
	{#if isPocketbaseAvailable === false}
		<div class="flex items-center justify-center">
			<div class="alert alert-error fixed z-50 mt-16 max-w-fit opacity-90">
				<p>
					Could not connect to <strong>Pocketbase</strong> on {env.PUBLIC_POCKETBASE_URL}. Is it
					running? 🧙
				</p>
			</div>
		</div>
	{/if}
	<head>
		<title>Grimoire</title>
	</head>
	<div class="min-w-screen flex flex-1 flex-col">
		<div class="z-1 navbar">
			<div class="flex">
				<a href="/" class="btn btn-ghost text-xl normal-case">grimoire</a>
			</div>
			<div class="navbar-center flex-1">
				<div class="form-control join join-horizontal mx-auto flex w-10/12">
					<input
						type="text"
						placeholder="Search"
						bind:value={$searchedValue}
						class={`input input-bordered w-full ${$searchedValue ? 'rounded-r-none' : ''}`}
					/>
					{#if $searchedValue}
						<button class="btn join-item" on:click={() => ($searchedValue = '')}>
							<IconX />
						</button>
					{/if}
				</div>
			</div>
			<div class="flex-none gap-2 md:mr-6">
				<ThemeSwitch />
				{#if !$user.isValid}
					<ul class="menu menu-horizontal px-1">
						<li><a href="/signup">Sign up</a></li>
						<li><a href="/login">Login</a></li>
					</ul>
				{:else if $user.isValid && $user.isAdmin}
					<form
						method="POST"
						action="/logout"
						use:enhance={() => {
							return async ({ result }) => {
								$user.clear();
								await applyAction(result);
							};
						}}
					>
						<button class="btn btn-outline btn-error btn-sm w-28">Log out admin</button>
					</form>
				{:else}
					<div class="dropdown dropdown-end z-10">
						<label for="avatar" tabindex="-1" class="avatar placeholder btn btn-circle btn-ghost">
							<div class="w-10 rounded-full bg-neutral text-neutral-content">
								<span> {$user.model?.name[0] || $user.model?.username[0]} </span>
							</div>
						</label>
						<ul
							tabindex="-1"
							class="menu dropdown-content menu-sm mt-3 w-auto gap-2 rounded-box bg-base-100 p-2 shadow"
						>
							<li>
								<a href="/profile" class="justify-between">
									Profile
									<!-- <span class="badge">New</span> -->
								</a>
							</li>
							<li><a href="/settings">Settings</a></li>
							<form
								method="POST"
								action="/logout"
								use:enhance={() => {
									return async ({ result }) => {
										$user.clear();
										await applyAction(result);
									};
								}}
							>
								<button class="btn btn-outline btn-error btn-sm w-24">Log out</button>
							</form>
						</ul>
					</div>
				{/if}
			</div>
		</div>
		<div class="z-2 mb-20 flex min-w-full flex-1 sm:mb-0">
			{#if user && !$user.isAdmin}
				<div class="drawer lg:drawer-open">
					<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
					<div class="justify-top drawer-content m-2 flex flex-1 flex-col items-center sm:m-8">
						<slot />
						<label
							for="my-drawer-2"
							class="btn btn-primary drawer-button fixed bottom-4 right-4 lg:hidden"
							><IconMenu /></label
						>
					</div>
					<div class="min-w-screen drawer-side min-h-full">
						<div class="flex h-14 flex-col items-end justify-center">
							{#if $page.url.pathname !== '/'}
								<a href="/" class="link">{'< Back to Home'}</a>
							{/if}
						</div>
						<label for="my-drawer-2" class="drawer-overlay" />
						<ul class="menu h-auto w-64 gap-4 rounded-r-xl bg-base-200 p-4 text-base-content">
							<!-- Sidebar content here -->
							<div>
								<div class="flex">
									<h3 class="text-xl">Categories</h3>
									<button
										class="link-hover link ml-auto opacity-50 hover:opacity-90"
										onclick="addCategoryModal.showModal()">➕</button
									>
								</div>
								<div class="flex flex-col p-2">
									<CategoryTree categories={$categoriesTree} />
								</div>
							</div>
							<div>
								<h3 class="text-xl">Tags</h3>
								<div class="flex flex-wrap p-2">
									{#each $page.data.tags as tag (tag.id)}
										{#if tag.bookmarks.length > 0}
											<a href={`/tags/${tag.slug}`} class="link m-1 hover:text-secondary"
												>#{tag.name}</a
											>
										{/if}
									{/each}
								</div>
							</div>
							<div>
								<h3 class="text-xl">Flows</h3>
								<div class="flex flex-wrap p-2">To be added.</div>
							</div>
						</ul>
					</div>
				</div>
			{:else}
				<div class="justify-top m-2 flex flex-1 flex-col items-center sm:m-8">
					<slot />
				</div>
			{/if}
		</div>
	</div>
	<Footer />
</div>
<!-- Modals -->
<AddBookmarkModal />
<EditBookmarkModal />
<ShowBookmarkModal />
<EditCategoryModal />
<AddCategoryModal />

<ToastNode
	toastOptions={{
		position: 'bottom-right'
	}}
/>

<style>
	/* SvelteSelect styling fix */
	:global(.this-select) {
		border: 0 !important;
		border-color: rgba(209, 213, 219, 0.5) !important;
		max-width: 10rem;
		background: oklch(var(--b1) / var(--tw-bg-opacity, 1)) !important;
	}
	:global(.svelte-select-list) {
		background-color: oklch(var(--b1) / var(--tw-bg-opacity, 1)) !important;
		box-shadow: 0 0 0 1px rgba(209, 213, 219, 0.5) !important;
	}
	:global(.svelte-select-list .list-item .item.hover) {
		background-color: oklch(var(--s) / var(--tw-bg-opacity, 1)) !important;
	}
	:global(.svelte-select .value-container .multi-item) {
		background-color: oklch(var(--nc)) !important;
	}
	:global(.svelte-select .value-container .multi-item .multi-item-clear svg) {
		color: oklch(var(--pc)) !important;
	}
</style>
