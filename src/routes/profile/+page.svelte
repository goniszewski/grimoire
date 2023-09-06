<script lang="ts">
	import { IconBookmarks, IconBookmarkPlus, IconEyeCheck } from '@tabler/icons-svelte';

	import { page } from '$app/stores';
	import { currentUser, pb } from '$lib/pb';

	const accountCreated = new Date($currentUser?.created || '').toLocaleDateString();
	const addedInLastSevenDays = $page.data.bookmarks.filter(
		(b) => new Date(b.created).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
	).length;
	const addedInLastSevenDaysPercentage = (
		(addedInLastSevenDays / $page.data.bookmarks.length) *
		100
	).toFixed(2);
	const bookmarksOpenedTimes = $page.data.bookmarks.reduce((acc, b) => acc + b.opened_times, 0);
	const bookmarksOpenedTimesPerBookmark = (
		bookmarksOpenedTimes / $page.data.bookmarks.length
	).toFixed(2);
</script>

{#if $currentUser?.id}
	<div>
		<div class="card lg:card-side bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title gap-0">
					Hello <span class="text-blue-600 ml-1">{$currentUser.name}</span>!
				</h2>
				<p>Click the button to listen on Spotiwhy app.</p>
				<h2 class="card-title">Your stats</h2>
				<div class="stats shadow">
					<div class="stat">
						<div class="stat-figure text-secondary">
							<IconBookmarks size={32} />
						</div>
						<div class="stat-title">Bookmarks total</div>
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
				<div class="card-actions justify-end">
					<button class="btn btn-primary">Edit Profile</button>
				</div>
			</div>
		</div>
	</div>
{:else}
	<p>Not logged in</p>
{/if}
