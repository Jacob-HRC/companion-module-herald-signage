import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const base = await generateEslintConfig({
	enableTypescript: true,
})

export default [
	...base,
	{
		// Tests run from the repo, never from the published package.
		files: ['src/**/*.test.ts'],
		rules: { 'n/no-unpublished-import': 'off' },
	},
]
