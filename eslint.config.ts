import { defineConfig, pvtnbr } from 'lintroll';

export default defineConfig([
	{
		ignores: [
			'docs/',
			'README.md',
		],
	},

	...pvtnbr(),
]);
