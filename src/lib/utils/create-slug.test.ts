import { describe, expect, it } from 'vitest';

import { createSlug } from './create-slug';

const testCases = [
	['Hello World', 'hello-world'],
	['Hello World!', 'hello-world'],
	['Hello World!!', 'hello-world'],
	['Some Very Complicated Text', 'some-very-complicated-text'],
	['@!#$%^&*()_+{}:"|<>?[];\',./`~', '_'],
	['@Starts and Ends with Special Characters!', 'starts-and-ends-with-special-characters']
];

describe('createSlug', () => {
	it('should create a simple slug', () => {
		expect(createSlug(testCases[0][0])).toBe(testCases[0][1]);
	});

	it('should create a slug with special characters', () => {
		expect(createSlug(testCases[1][0])).toBe(testCases[1][1]);
		expect(createSlug(testCases[2][0])).toBe(testCases[2][1]);
	});

	it('should create a slug with spaces', () => {
		expect(createSlug(testCases[3][0])).toBe(testCases[3][1]);
	});

	it('should create a slug with many special characters', () => {
		expect(createSlug(testCases[4][0])).toBe(testCases[4][1]);
		expect(createSlug(testCases[5][0])).toBe(testCases[5][1]);
	});
});
