import type { SomeCompanionConfigField } from '@companion-module/base'

export type ModuleConfig = {
	url: string
	poll_seconds: number
}

export type ModuleSecrets = {
	token: string
}

export const DEFAULT_POLL_SECONDS = 3

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'intro',
			label: 'Setup',
			width: 12,
			value:
				'In Herald, open your account page and create an API token. The token acts as you: it can drive the screens you can, and emergency overrides and restarts need an admin. Settings → Integrations in Herald lists everything this module can do.',
		},
		{
			type: 'textinput',
			id: 'url',
			label: 'Herald URL',
			tooltip: 'The address you sign in to Herald at, e.g. https://yourchurch.heraldsignage.com',
			width: 8,
			default: 'https://',
			regex: '/^https?:\\/\\/[^\\s/]+(\\/.*)?$/',
		},
		{
			type: 'secret-text',
			id: 'token',
			label: 'API token',
			tooltip: 'Starts with hrd_pat_',
			width: 8,
			regex: '/^hrd_pat_\\S+$/',
		},
		{
			type: 'number',
			id: 'poll_seconds',
			label: 'Check for changes every (seconds)',
			tooltip: 'How often button colours and variables refresh from Herald.',
			width: 4,
			min: 1,
			max: 60,
			default: DEFAULT_POLL_SECONDS,
		},
	]
}
