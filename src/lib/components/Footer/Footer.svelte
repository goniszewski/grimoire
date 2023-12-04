<script lang="ts">
	import { IconBrandGithub } from '@tabler/icons-svelte';
	import { writable } from 'svelte/store';
	import { version } from '$app/environment';

	const definitionKeyWords = [
		'dark knowledge',
		'enchantment',
		'incantation',
		'magic',
		'ritual',
		'sorcery',
		'spell',
		'witchcraft',
		'wizardry'
	];
	let lastUsedKeyWord = '';

	const definitionKeyWord = writable('bookmark');

	const getRandomKeyWord = () => {
		const filteredKeyWords = definitionKeyWords.filter((keyWord) => keyWord !== lastUsedKeyWord);
		return filteredKeyWords[Math.floor(Math.random() * filteredKeyWords.length)];
	};
</script>

<footer class="footer items-center p-4 bg-neutral text-neutral-content">
	<aside class="items-center grid-flow-col">
		<p>
			<span class="font-bold">Grimoire</span>, open source
			<span
				class={`py-2 ${$definitionKeyWord !== 'bookmark' ? 'animate-pulse' : ''}`}
				role="term"
				on:mouseover={() => {
					$definitionKeyWord = getRandomKeyWord();
					lastUsedKeyWord = $definitionKeyWord;
				}}
				on:focus={() => {
					$definitionKeyWord = getRandomKeyWord();
					lastUsedKeyWord = $definitionKeyWord;
				}}
				on:mouseout={() => ($definitionKeyWord = 'bookmark')}
				on:blur={() => ($definitionKeyWord = 'bookmark')}>{$definitionKeyWord}</span
			> manager.
		</p>
	</aside>
	<nav class="grid-flow-col gap-4 md:place-self-center md:justify-self-end">
		<span class=" text-neutral-content">
			version: {version}
		</span>
		<a href="/about" target="_self" title="About page" class="link link-hover"> about </a>
		<a
			href="https://grimoire.pro/"
			target="_blank"
			title="Grimoire.pro website"
			class="link link-hover"
		>
			grimoire.pro
		</a>
		<a href="https://github.com/goniszewski/grimoire" target="_blank" title="Grimoire on GitHub">
			<IconBrandGithub size={24} />
		</a>
	</nav>
</footer>
