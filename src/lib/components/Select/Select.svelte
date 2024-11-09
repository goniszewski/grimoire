<script lang="ts">
import Select from 'svelte-select';
import { writable } from 'svelte/store';

const containerStyles = writable({
	'min-height': '32px',
	'max-width': '10rem',
	'background-color': 'oklch(var(--b1) / var(--tw-bg-opacity, 1))',
	'border-color': 'oklch(var(--p) / var(--tw-bg-opacity, 1))',
	'border-radius': '0.375rem',
	'border-width': '1px',
	'border-style': 'solid',
	'font-size': '14px'
});
const inputStyles = writable({
	'font-size': '14px'
});

const sizes = {
	sm: {
		container: {
			'min-height': '24px'
		},
		input: {
			'font-size': '12px'
		}
	},
	md: {
		container: {
			'min-height': '32px'
		},
		input: {
			'font-size': '14px'
		}
	},
	lg: {
		container: {
			'min-height': '40px'
		},
		input: {
			'font-size': '16px'
		}
	}
};

export let border: boolean = true;
export let children: any = null;
export let className: string | undefined = undefined;
export let filterText: string | undefined = undefined;
export let groupBy = false;
export let items: { value: string; label: string; group?: string }[] = [];
export let listAutoWidth: boolean = false;
export let maxWidth: string | null = null;
export let multiple: boolean = false;
export let name = 'Search';
export let onFilter: any = () => {};
export let onInput: any = () => {};
export let onSelect: any = () => {};
export let placeholder = 'Please select';
export let searchable: boolean = true;
export let size: 'sm' | 'md' | 'lg' = 'md';
export let value: any = null;

$: {
	containerStyles.set({
		...$containerStyles,
		...sizes[size].container,
		...(maxWidth ? { 'max-width': maxWidth } : {}),
		...(border ? {} : { border: 'none' })
	});
	inputStyles.set({
		...$inputStyles,
		...sizes[size].input
	});
}
</script>

<Select
	name={name}
	searchable={searchable}
	placeholder={placeholder}
	items={items}
	containerStyles="border-color: oklch(var(--p));	max-width: 10rem; background: oklch(var(--b1) / var(--tw-bg-opacity, 1)); min-height: 32px;"
	inputStyles="font-size: 14px;"
	groupBy={groupBy ? (item) => item.group : undefined}
	value={value}
	filterText={filterText}
	class={className}
	listAutoWidth={listAutoWidth}
	multiple={multiple}
	on:change={onSelect}
	on:filter={onFilter}
	on:input={onInput}>
	{children}
</Select>
