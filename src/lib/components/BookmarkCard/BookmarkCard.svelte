<script lang="ts">
	import type { Bookmark } from '$lib/interfaces/Bookmark.interface';
	import config from '$lib/config';
	export let bookmark: Bookmark = {} as Bookmark;
	let importanceForm: HTMLFormElement;
</script>

<div class="relative card w-full sm:w-96 bg-base-100 shadow-xl">
	<figure class="relative h-36">
		<img src={bookmark.main_image || bookmark.main_image_url} alt="Main" />
		<div class="badge badge-xl absolute top-1 left-1">{bookmark.category.name}</div>

		<form bind:this={importanceForm} method="POST" action="?/updateImportance">
			<input type="hidden" name="id" value={bookmark.id} />
			<div class="badge rating rating-sm opacity-90 absolute bottom-1 left-1">
				<input
					type="radio"
					name="importance"
					class="rating-hidden"
					checked={!bookmark.importance}
					value="0"
					on:change={() => importanceForm.requestSubmit()}
				/>
				<input
					type="radio"
					name="importance"
					class="mask mask-star-2 bg-orange-400"
					checked={bookmark.importance === 1}
					value="1"
					on:change={() => importanceForm.requestSubmit()}
				/>
				<input
					type="radio"
					name="importance"
					class="mask mask-star-2 bg-orange-400"
					checked={bookmark.importance === 2}
					value="2"
					on:change={() => importanceForm.requestSubmit()}
				/>
				<input
					type="radio"
					name="importance"
					class="mask mask-star-2 bg-orange-400"
					checked={bookmark.importance === 3}
					value="3"
					on:change={() => {
						importanceForm.requestSubmit();
					}}
				/>
			</div>
		</form>
		<div class="absolute bottom-1 right-1 scale-90">
			<label class="swap btn btn-circle btn-xs p-4">
				<input type="checkbox" checked={!!bookmark.read} />
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="grey"
					class="swap-off w-6 h-6"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="swap-on w-6 h-6"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
					/>
				</svg>
			</label>
			<label class="swap btn btn-circle btn-xs p-4">
				<input type="checkbox" checked={!!bookmark.flagged} />
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="swap-on w-6 h-6"
				>
					<path
						fill-rule="evenodd"
						d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.77l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z"
						clip-rule="evenodd"
					/>
				</svg>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="grey"
					class="swap-off w-6 h-6"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
					/>
				</svg>
			</label>
		</div>
	</figure>
	<div class="card-body p-2">
		<h2 class="card-title flex flex-wrap text-lg">
			<span
				><img
					src={bookmark.icon || bookmark.icon_url}
					alt={`${bookmark.domain}'s favicon`}
					class="avatar w-4"
				/>
				<a href={bookmark.url} title={bookmark.url} target="_self">{bookmark.title}</a>
				<a href={bookmark.url} target="_blank" class="btn btn-xs btn-circle btn-ghost">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-6 h-6 w-3 h-3"
					>
						<path
							fill-rule="evenodd"
							d="M15.75 2.25H21a.75.75 0 01.75.75v5.25a.75.75 0 01-1.5 0V4.81L8.03 17.03a.75.75 0 01-1.06-1.06L19.19 3.75h-3.44a.75.75 0 010-1.5zm-10.5 4.5a1.5 1.5 0 00-1.5 1.5v10.5a1.5 1.5 0 001.5 1.5h10.5a1.5 1.5 0 001.5-1.5V10.5a.75.75 0 011.5 0v8.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V8.25a3 3 0 013-3h8.25a.75.75 0 010 1.5H5.25z"
							clip-rule="evenodd"
						/>
					</svg>
				</a>
			</span>
			<div class="badge badge-ghost">{bookmark.domain}</div>
		</h2>
		<p class="font-light text-sm text-gray-700 line-clamp-2">
			{bookmark.description}
		</p>
		<div class="card-actions justify-end px-2 font-medium tracking-tight gap-1">
			<span class="font-sans font-semibold text-xs">#</span>
			{#if bookmark.tags}
				{#each bookmark.tags as tag}
					<a href={`/tags/${tag.name}`} class="link font-sans text-xs">{tag.name}</a>
				{/each}
			{/if}
			<button class="link link-hover font-sans text-xs text-gray-400">+</button>
		</div>
	</div>
	<div class="dropdown dropdown-end absolute top-1 right-1">
		<label for="options" tabindex="0" class="btn btn-circle btn-ghost btn-xs">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="w-6 h-6"
			>
				<path
					fill-rule="evenodd"
					d="M4.5 12a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"
					clip-rule="evenodd"
				/>
			</svg>
		</label>
		<ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-28">
			<li><a>Edit</a></li>
			<li><a>Remove</a></li>
		</ul>
	</div>
</div>
