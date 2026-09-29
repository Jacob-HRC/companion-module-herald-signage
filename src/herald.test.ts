import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	ANY_OVERRIDE,
	BUNDLED_ACTIONS,
	buildRequest,
	choicesFor,
	companionActionId,
	devicePowerIs,
	deviceShowing,
	errorMessage,
	mergeActions,
	overrideActive,
	streamMatches,
	type Catalog,
	type CatalogAction,
	type HeraldState,
} from './herald.js'

const fixture = JSON.parse(
	readFileSync(new URL('../test/fixtures/catalog-v1.json', import.meta.url), 'utf8'),
) as Catalog

// The fields that decide what request a button sends. Names and descriptions
// may be worded differently here; the request must not be.
function requestShape(a: CatalogAction) {
	return {
		id: a.id,
		method: a.method,
		path: a.path,
		params: a.params.map((p) => ({
			key: p.key,
			kind: p.kind,
			in: p.in,
			field: p.field,
			choices: p.choices?.map((c) => c.value) ?? null,
		})),
		fixed_body: a.fixed_body,
		min_role: a.min_role,
	}
}

const byId = (actions: CatalogAction[], id: string) => actions.find((a) => a.id === id)!

const state: HeraldState = {
	generated_at: '2026-09-29T14:00:00.000Z',
	override: { id: 'ovr-1', name: 'Severe weather', state: 'active', activated_at: null },
	devices: [
		{
			id: 'd1',
			name: 'Lobby TV',
			site_name: 'Sanctuary',
			online: true,
			display_power: 'on',
			tv_power: 'on',
			playlist_id: 'pl-1',
			stream_id: null,
			web_page_id: null,
			asset_version_id: null,
			override_id: 'ovr-1',
		},
		{
			id: 'd2',
			name: 'Kids Hallway',
			site_name: null,
			online: false,
			display_power: 'standby',
			tv_power: null,
			playlist_id: null,
			stream_id: 's-1',
			web_page_id: null,
			asset_version_id: null,
			override_id: null,
		},
	],
	streams: [
		{ id: 's-1', name: 'Sanctuary feed', status: 'healthy' },
		{ id: 's-2', name: 'Chapel feed', status: 'relay_offline' },
	],
}

describe('bundled catalog', () => {
	it("matches Herald's catalog v1 request for request", () => {
		expect(fixture.version).toBe(1)
		expect(BUNDLED_ACTIONS.map(requestShape)).toEqual(fixture.actions.map(requestShape))
	})

	it('maps catalog ids to Companion ids', () => {
		expect(companionActionId('device.stream.stop')).toBe('device_stream_stop')
	})

	it('keeps bundled actions the live catalog leaves out, and takes new ones from it', () => {
		const extra: CatalogAction = { ...byId(BUNDLED_ACTIONS, 'device.power'), id: 'device.identify', name: 'Identify' }
		const live = [{ ...byId(BUNDLED_ACTIONS, 'device.playlist'), name: 'Live name' }, extra]
		const merged = mergeActions(live)
		expect(merged).toHaveLength(BUNDLED_ACTIONS.length + 1)
		expect(byId(merged, 'device.playlist').name).toBe('Live name')
		expect(byId(merged, 'override.activate')).toBeDefined()
		expect(mergeActions(null)).toEqual(BUNDLED_ACTIONS)
	})
})

describe('buildRequest', () => {
	it('fills path segments and body fields, over the fixed body', () => {
		expect(buildRequest(byId(BUNDLED_ACTIONS, 'device.media'), { media: 'v 1', device: 'd1' })).toEqual({
			ok: true,
			method: 'POST',
			path: '/api/v1/media/v%201/display',
			body: { device_id: 'd1' },
		})
		expect(buildRequest(byId(BUNDLED_ACTIONS, 'device.stream.stop'), { device: 'd1' })).toMatchObject({
			body: { stream_id: null },
		})
	})

	it('names what is missing', () => {
		expect(buildRequest(byId(BUNDLED_ACTIONS, 'device.playlist'), { device: 'd1', playlist: '' })).toEqual({
			ok: false,
			missing: ['Playlist'],
		})
	})
})

describe('feedback logic', () => {
	it('matches what a screen is showing by id', () => {
		expect(deviceShowing(state, 'd1', 'playlist', 'pl-1')).toBe(true)
		expect(deviceShowing(state, 'd1', 'playlist', 'pl-2')).toBe(false)
		expect(deviceShowing(state, 'd2', 'stream', 's-1')).toBe(true)
		expect(deviceShowing(state, 'nope', 'stream', 's-1')).toBe(false)
		expect(deviceShowing(null, 'd1', 'playlist', 'pl-1')).toBe(false)
	})

	it('treats standby as off', () => {
		expect(devicePowerIs(state, 'd1', 'on')).toBe(true)
		expect(devicePowerIs(state, 'd2', 'off')).toBe(true)
		expect(devicePowerIs(state, 'd2', 'on')).toBe(false)
	})

	it('matches a particular override or any', () => {
		expect(overrideActive(state, ANY_OVERRIDE)).toBe(true)
		expect(overrideActive(state, 'ovr-1')).toBe(true)
		expect(overrideActive(state, 'ovr-2')).toBe(false)
		expect(overrideActive({ ...state, override: null }, ANY_OVERRIDE)).toBe(false)
	})

	it('groups stream statuses into healthy, problem and idle', () => {
		expect(streamMatches('healthy', 'healthy')).toBe(true)
		expect(streamMatches('relay_offline', 'problem')).toBe(true)
		expect(streamMatches('warming', 'problem')).toBe(false)
		expect(streamMatches('idle', 'idle')).toBe(true)
		expect(streamMatches(undefined, 'healthy')).toBe(false)
	})

	it('labels choices with their detail', () => {
		expect(choicesFor('device', { device: [{ id: 'd1', name: 'Lobby TV', detail: 'Sanctuary' }] })).toEqual([
			{ id: 'd1', label: 'Lobby TV (Sanctuary)' },
		])
		expect(choicesFor('playlist', null)).toEqual([])
	})
})

describe('errorMessage', () => {
	it("reads Herald's error envelope and the bare form", () => {
		expect(errorMessage(409, JSON.stringify({ error: { code: 'CONFLICT', message: 'Already live' } }))).toBe(
			'HTTP 409: Already live',
		)
		expect(errorMessage(401, JSON.stringify({ error: 'unauthorized' }))).toBe('HTTP 401: unauthorized')
		expect(errorMessage(502, '<html>')).toBe('HTTP 502')
	})
})
