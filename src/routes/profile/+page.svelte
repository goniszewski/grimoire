<script lang="ts">
	import { IconBookmarkPlus, IconBookmarks, IconEyeCheck } from '@tabler/icons-svelte';

	import { page } from '$app/stores';

	const accountCreated = new Date($page.data.user?.created || '').toLocaleDateString();
	const addedInLastSevenDays = $page.data.bookmarks.filter(
		(b) => new Date(b.created).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
	).length;
	const addedInLastSevenDaysPercentage = (
		(addedInLastSevenDays / $page.data.bookmarks.length) *
		100
	).toFixed(2);
	const bookmarksOpenedTimes = $page.data.bookmarks.reduce((acc, b) => acc + b.openedTimes, 0);
	const bookmarksOpenedTimesPerBookmark = (
		bookmarksOpenedTimes / $page.data.bookmarks.length
	).toFixed(2);

	const displayAddedDate = (date: Date) => {
		const relativeDate = (
			(new Date().getTime() - new Date(date).getTime()) /
			(1000 * 3600 * 24)
		).toFixed(0);
		return relativeDate === '0' ? 'today' : `${relativeDate} days ago`;
	};
</script>

{#if !$page.data.user}
	<p>Not logged in</p>
{:else}
	<div>
		<div class="card bg-base-100 shadow-xl lg:card-side">
			<div class="card-body gap-5">
				<h2 class="card-title gap-0">
					Hello <span class="ml-1 text-blue-600">{$page.data.user?.name}</span>!
				</h2>
				<p>Welcome to your profile page. Here you can see your stats and latest bookmarks.</p>
				<h2 class="card-title">Your stats</h2>
				<div class=" flex-col shadow md:stats">
					<div class="stat">
						<div class="stat-figure text-secondary">
							<IconBookmarks size={32} />
						</div>
						<div class="stat-title">Bookmarks added</div>
						<div class="stat-value">{$page.data.bookmarks.length}</div>
						<div class="stat-desc">
							since <span class="text-blue-600">{accountCreated}</span>
						</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-secondary">
							<IconBookmarkPlus size={32} />
						</div>
						<div class="stat-title">Added last week</div>
						<div class="stat-value">
							{addedInLastSevenDays}
						</div>
						<div class="stat-desc">
							{parseFloat(addedInLastSevenDaysPercentage) > 0
								? `↗︎
							${addedInLastSevenDaysPercentage}%`
								: `↘︎
							${addedInLastSevenDaysPercentage}%`}
						</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-secondary">
							<IconEyeCheck size={32} />
						</div>
						<div class="stat-title">Opened times</div>
						<div class="stat-value">
							{bookmarksOpenedTimes}
						</div>
						<div class="stat-desc">
							{bookmarksOpenedTimesPerBookmark} times per bookmark
						</div>
					</div>
				</div>
				<h2 class="card-title">Latest bookmarks</h2>
				{#if $page.data.bookmarks.length > 0}
					<div class="flex w-full columns-sm flex-col gap-2">
						{#each $page.data.bookmarks.slice(0, 3) as bookmark (bookmark.id)}
							<a
								href={bookmark.url}
								title={bookmark.url}
								target="_blank"
								class="rounded-md p-2 hover:bg-base-300"
								><div class="flex flex-col gap-2 md:flex-row">
									<div class="flex gap-2">
										<img
											src={bookmark.icon || bookmark.iconUrl}
											alt={`${bookmark.domain}'s favicon`}
											class="avatar h-6 w-6"
										/>
										<h3 class="text-md max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">
											{bookmark.title}
										</h3>
									</div>
									<div class="ml-8 flex gap-1 sm:ml-auto">
										<span
											style={`color: ${bookmark.category.color || '#a0a0a0'};`}
											title={bookmark.category.description ? bookmark.category.description : ''}
										>
											{bookmark.category.name}
										</span>
										<span
											class="w-36 text-end"
											title={`On ${new Date(bookmark.created).toLocaleDateString()}`}
										>
											added {displayAddedDate(bookmark.created)}
										</span>
									</div>
								</div></a
							>
						{/each}
					</div>
				{:else}
					<p>No bookmarks yet.</p>
				{/if}
				<div class="card-actions mt-4 justify-end">
					<a href="/profile/edit" class="btn btn-primary">Edit Profile</a>
				</div>
			</div>
		</div>
	</div>
{/if}
