// Herald's integration API as this module sees it: the action catalog
// (GET /api/v1/integrations/catalog) and the state snapshot
// (GET /api/v1/integrations/state), plus the pure logic built on them.
// No Companion or network code here, so it can be unit-tested directly.

export type ParamKind = 'device' | 'group' | 'playlist' | 'stream' | 'web_page' | 'media' | 'override' | 'choice'
export type OptionKind = Exclude<ParamKind, 'choice'>

export interface CatalogParam {
	key: string
	label: string
	kind: ParamKind
	in: 'path' | 'body'
	field: string | null
	choices: { value: string; label: string }[] | null
}

export interface CatalogAction {
	id: string
	category: string
	name: string
	description: string
	method: string
	path: string
	params: CatalogParam[]
	fixed_body: Record<string, unknown>
	min_role: 'operator' | 'admin'
	destructive: boolean
}

export interface CatalogOption {
	id: string
	name: string
	detail?: string | null
}

export type CatalogOptions = Partial<Record<OptionKind, CatalogOption[]>>

export interface Catalog {
	version: number
	actions: CatalogAction[]
	options: CatalogOptions | null
}

export interface HeraldState {
	generated_at: string
	override: { id: string; name: string; state: string; activated_at: string | null } | null
	devices: {
		id: string
		name: string
		site_name: string | null
		online: boolean
		display_power: string | null
		tv_power: string | null
		playlist_id: string | null
		stream_id: string | null
		web_page_id: string | null
		asset_version_id: string | null
		override_id: string | null
	}[]
	streams: { id: string; name: string; status: string }[]
}

const DEVICE: CatalogParam = { key: 'device', label: 'Screen', kind: 'device', in: 'path', field: null, choices: null }
const GROUP: CatalogParam = { key: 'group', label: 'Group', kind: 'group', in: 'path', field: null, choices: null }
const body = (key: string, label: string, kind: ParamKind, field: string): CatalogParam => ({
	key,
	label,
	kind,
	in: 'body',
	field,
	choices: null,
})

/**
 * Catalog v1 as shipped with this module. Buttons are defined from it at
 * startup, so a button keeps its action even when Herald can't be reached
 * yet. The live catalog replaces it once fetched, which also picks up actions
 * Herald adds later.
 */
export const BUNDLED_ACTIONS: CatalogAction[] = [
	{
		id: 'device.playlist',
		category: 'playback',
		name: 'Play a playlist on a screen',
		description: 'Switches one screen to a playlist.',
		method: 'POST',
		path: '/api/v1/devices/{device}/playlist',
		params: [DEVICE, body('playlist', 'Playlist', 'playlist', 'playlist_id')],
		fixed_body: {},
		min_role: 'operator',
		destructive: false,
	},
	{
		id: 'group.playlist',
		category: 'playback',
		name: 'Play a playlist on a group',
		description: 'Switches every screen in a group to a playlist.',
		method: 'POST',
		path: '/api/v1/device-groups/{group}/assignment',
		params: [GROUP, body('playlist', 'Playlist', 'playlist', 'playlist_id')],
		fixed_body: {},
		min_role: 'operator',
		destructive: false,
	},
	{
		id: 'device.media',
		category: 'playback',
		name: 'Show a picture or video on a screen',
		description: 'Puts one item from the media library on a screen.',
		method: 'POST',
		path: '/api/v1/media/{media}/display',
		params: [
			{ key: 'media', label: 'Media', kind: 'media', in: 'path', field: null, choices: null },
			body('device', 'Screen', 'device', 'device_id'),
		],
		fixed_body: {},
		min_role: 'operator',
		destructive: false,
	},
	{
		id: 'device.web_page',
		category: 'playback',
		name: 'Show a web page on a screen',
		description: 'Puts a web dashboard or countdown on a screen.',
		method: 'POST',
		path: '/api/v1/devices/{device}/web-page',
		params: [DEVICE, body('web_page', 'Web page', 'web_page', 'web_page_id')],
		fixed_body: {},
		min_role: 'operator',
		destructive: false,
	},
	{
		id: 'device.stream',
		category: 'streams',
		name: 'Show a live stream on a screen',
		description: 'Switches a screen to a live stream.',
		method: 'POST',
		path: '/api/v1/devices/{device}/stream',
		params: [DEVICE, body('stream', 'Stream', 'stream', 'stream_id')],
		fixed_body: {},
		min_role: 'operator',
		destructive: false,
	},
	{
		id: 'device.stream.stop',
		category: 'streams',
		name: 'Stop the live stream on a screen',
		description: 'Takes a screen off its live stream.',
		method: 'POST',
		path: '/api/v1/devices/{device}/stream',
		params: [DEVICE],
		fixed_body: { stream_id: null },
		min_role: 'operator',
		destructive: false,
	},
	{
		id: 'group.stream',
		category: 'streams',
		name: 'Show a live stream on a group',
		description: 'Switches every screen in a group to a live stream.',
		method: 'POST',
		path: '/api/v1/device-groups/{group}/assignment',
		params: [GROUP, body('stream', 'Stream', 'stream', 'stream_id')],
		fixed_body: {},
		min_role: 'operator',
		destructive: false,
	},
	{
		id: 'override.activate',
		category: 'overrides',
		name: 'Start an emergency override',
		description: 'Puts a prepared emergency override on screen. Needs an admin token.',
		method: 'POST',
		path: '/api/v1/overrides/{override}/activate',
		params: [{ key: 'override', label: 'Override', kind: 'override', in: 'path', field: null, choices: null }],
		fixed_body: {},
		min_role: 'admin',
		destructive: true,
	},
	{
		id: 'override.clear',
		category: 'overrides',
		name: 'End an emergency override',
		description: 'Clears a live override. Needs an admin token.',
		method: 'POST',
		path: '/api/v1/overrides/{override}/clear',
		params: [{ key: 'override', label: 'Override', kind: 'override', in: 'path', field: null, choices: null }],
		fixed_body: {},
		min_role: 'admin',
		destructive: false,
	},
	{
		id: 'device.power',
		category: 'display',
		name: 'Turn a screen on or off',
		description: 'Wakes or sleeps the TV.',
		method: 'POST',
		path: '/api/v1/devices/{device}/power',
		params: [
			DEVICE,
			{
				key: 'power',
				label: 'Power',
				kind: 'choice',
				in: 'body',
				field: 'power',
				choices: [
					{ value: 'on', label: 'On' },
					{ value: 'off', label: 'Off' },
				],
			},
		],
		fixed_body: {},
		min_role: 'operator',
		destructive: false,
	},
	{
		id: 'device.restart_playback',
		category: 'system',
		name: 'Restart playback on a screen',
		description: 'Restarts the player without rebooting. Needs an admin token.',
		method: 'POST',
		path: '/api/v1/devices/{device}/actions',
		params: [DEVICE],
		fixed_body: { action: 'restart_playback' },
		min_role: 'admin',
		destructive: true,
	},
	{
		id: 'device.reboot',
		category: 'system',
		name: "Reboot a screen's player",
		description: 'Reboots the player box. Needs an admin token.',
		method: 'POST',
		path: '/api/v1/devices/{device}/actions',
		params: [DEVICE],
		fixed_body: { action: 'reboot' },
		min_role: 'admin',
		destructive: true,
	},
]

/** Companion action ids are the catalog ids with dots swapped for underscores. */
export function companionActionId(catalogId: string): string {
	return catalogId.replace(/[^a-z0-9_]/gi, '_')
}

/**
 * The actions to define: every bundled action (so saved buttons never lose
 * theirs, even if this token's role can't run it) plus anything newer the
 * live catalog has. Where both have an action, the live one wins.
 */
export function mergeActions(live: CatalogAction[] | null): CatalogAction[] {
	const byId = new Map(BUNDLED_ACTIONS.map((a) => [a.id, a]))
	for (const a of live ?? []) byId.set(a.id, a)
	return [...byId.values()]
}

export type BuiltRequest =
	{ ok: true; method: string; path: string; body: Record<string, unknown> } | { ok: false; missing: string[] }

export function buildRequest(action: CatalogAction, values: Record<string, string | undefined>): BuiltRequest {
	const missing = action.params.filter((p) => !values[p.key]).map((p) => p.label)
	if (missing.length > 0) return { ok: false, missing }
	let path = action.path
	const out: Record<string, unknown> = { ...action.fixed_body }
	for (const p of action.params) {
		const v = values[p.key]!.trim()
		if (p.in === 'path') path = path.replace(`{${p.key}}`, encodeURIComponent(v))
		else out[p.field ?? p.key] = v
	}
	return { ok: true, method: action.method, path, body: out }
}

export interface Choice {
	id: string
	label: string
}

export function choicesFor(kind: OptionKind, options: CatalogOptions | null): Choice[] {
	return (options?.[kind] ?? []).map((o) => ({ id: o.id, label: o.detail ? `${o.name} (${o.detail})` : o.name }))
}

/** Stream statuses a "healthy" feedback accepts, and the ones that mean trouble. */
const STREAM_OK = new Set(['healthy'])
const STREAM_PROBLEM = new Set(['degraded', 'failed', 'relay_offline', 'no_relay_ip', 'relay_missing'])

export type StreamCondition = 'healthy' | 'problem' | 'idle'

export function streamMatches(status: string | undefined, condition: StreamCondition): boolean {
	if (status === undefined) return false
	if (condition === 'healthy') return STREAM_OK.has(status)
	if (condition === 'problem') return STREAM_PROBLEM.has(status)
	return status === 'idle'
}

export type ShowingKind = 'playlist' | 'stream' | 'web_page' | 'media'

/** Is this screen showing that item right now (as the screen last reported)? */
export function deviceShowing(state: HeraldState | null, deviceId: string, kind: ShowingKind, itemId: string): boolean {
	const d = state?.devices.find((x) => x.id === deviceId)
	if (!d || !itemId) return false
	switch (kind) {
		case 'playlist':
			return d.playlist_id === itemId
		case 'stream':
			return d.stream_id === itemId
		case 'web_page':
			return d.web_page_id === itemId
		case 'media':
			return d.asset_version_id === itemId
	}
}

/** "off" matches a screen that's off or in standby. */
export function devicePowerIs(state: HeraldState | null, deviceId: string, power: 'on' | 'off'): boolean {
	const d = state?.devices.find((x) => x.id === deviceId)
	if (!d || d.display_power === null) return false
	return power === 'on' ? d.display_power === 'on' : d.display_power !== 'on'
}

export const ANY_OVERRIDE = '__any__'

export function overrideActive(state: HeraldState | null, overrideId: string): boolean {
	const o = state?.override
	if (!o) return false
	return overrideId === ANY_OVERRIDE || o.id === overrideId
}

/** An option value as a string: Companion hands options over as JSON values. */
export function optionText(value: unknown, fallback = ''): string {
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	return fallback
}

/** Pull a readable reason out of a Herald error response. */
export function errorMessage(status: number, bodyText: string): string {
	try {
		const parsed = JSON.parse(bodyText) as { error?: { message?: string } | string }
		if (typeof parsed.error === 'string') return `HTTP ${status}: ${parsed.error}`
		if (parsed.error?.message) return `HTTP ${status}: ${parsed.error.message}`
	} catch {
		// not JSON
	}
	return `HTTP ${status}`
}
