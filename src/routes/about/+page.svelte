<script lang="ts">
import { page } from '$app/stores';
</script>

<div class="w-full">
	<h1 class="text-2xl font-bold">About</h1>
	<div class="mb-14 flex w-full flex-wrap">
		<div class="mt-4 flex max-w-fit flex-none flex-col gap-2 indent-8 md:max-w-xl">
			<div class="mb-6 mt-8 flex items-center justify-center">
				<img
					srcset="grimoire_logo_300.webp 300w,
					grimoire_logo_600.webp 600w,
					grimoire_logo.webp 960w"
					alt="Grimoire logo"
					class="max-w-[20rem]" />
			</div>
			<p>
				Glimpse into the magical book of <em>your</em> forbidden knowledge -
			</p>
			<p class="mx-auto my-2">
				<strong class="font-serif text-3xl"><em>Grimoire!</em></strong> 📖💫
			</p>
			<p>
				Unleash your inner sorcerer and conquer the chaos of bookmarks! With Grimoire, you'll have a
				bewitching way to store and sort your enchanted links.
			</p>
			<p>
				But wait, there's <strong> more</strong>!
			</p>
			<p>
				Transmute your saved pages into juicy content snippets with our mystical extraction feature.
				Embrace the magic, tame the clutter, and let Grimoire be your mystical companion in the vast
				library of the web.
			</p>
			<p>It's time to conjure up some organization! 📚✨</p>
		</div>
		<div class="flex min-w-fit flex-1 flex-col">
			<div class="flex flex-col items-center justify-center">
				<h2 class="mb-4 mt-8 text-xl font-bold">Developers and contributors</h2>
				<div class="flex flex-col gap-1">
					<div class="flex max-w-[14rem] items-center">
						<div class="indicator">
							<span class="badge indicator-item badge-primary badge-sm indicator-middle"
								>author</span>
							<a href="https://www.github.com/goniszewski" class="px-4 text-center hover:underline">
								Robert Goniszewski (@goniszewski)
							</a>
						</div>
					</div>
					{#if $page.data.contributors.length > 0}
						{#each $page.data.contributors as contributor}
							<div class="flex max-w-[14rem] items-center justify-center">
								<div
									class="tooltip"
									data-tip={`Thank you for ${contributor.contributions} contribution${contributor.contributions > 1 ? 's' : ''}!`}>
									<div class="indicator">
										<span class="badge indicator-item badge-accent badge-sm indicator-middle"
											>{contributor.contributions}</span>
										<a href={contributor.html_url} class="px-4 text-center hover:underline">
											{contributor.login}
										</a>
									</div>
								</div>
							</div>
						{/each}
						<!-- {#if $page.data.contributors.length ===10} -->
						<div class="flex items-center justify-center">
							<div class="tooltip" data-tip="Thank you for your contribution!">
								<a
									href="https://github.com/goniszewski/grimoire/graphs/contributors"
									class="pl-4 text-center link">
									And others...
								</a>
							</div>
						</div>
						<!-- {/if} -->
					{/if}
				</div>
			</div>
			<div class="mt-8 flex flex-col items-center">
				<h2 class="mb-4 mt-8 text-xl font-bold">Special thanks to</h2>
				<p class="flex flex-col items-center gap-1">
					<a href="https://github.com/extractus/article-extractor" class="hover:underline">
						@extractus/article-extractor</a>
					<a href="https://github.com/oven-sh/bun" class="hover:underline">Bun</a>
					<a href="https://github.com/saadeghi/daisyui" class="hover:underline">DaisyUI</a>
					<a href="https://github.com/drizzle-team/drizzle-orm" class="hover:underline">Drizzle</a>
					<a href="https://github.com/krisk/fuse" class="hover:underline">Fuse.js</a>
					<a href="https://github.com/microlinkhq/metascraper" class="hover:underline">MetaScraper</a>
					<a href="https://github.com/pocketbase/pocketbase" class="hover:underline">PocketBase</a>
					<a href="https://github.com/apostrophecms/sanitize-html" class="hover:underline">sanitize-html</a>
					<a href="https://github.com/sveltejs/kit" class="hover:underline">SvelteKit</a>
					<a href="https://github.com/kbrgl/svelte-french-toast" class="hover:underline">Svelte French Toast</a>
					<a href="https://github.com/rob-balfre/svelte-select" class="hover:underline">Svelte Select</a>
					<a href="https://tailwindcss.com" class="hover:underline">Tailwind CSS</a>
					<a href="https://github.com/laurengarcia/url-metadata" class="hover:underline">url-metadata</a>
				</p>
			</div>
		</div>
	</div>
</div>
