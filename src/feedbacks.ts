import { combineRgb, type CompanionFeedbackDefinitions, type DropdownChoice } from '@companion-module/base'
import {
	ANY_OVERRIDE,
	choicesFor,
	devicePowerIs,
	deviceShowing,
	optionText,
	overrideActive,
	streamMatches,
	type OptionKind,
	type ShowingKind,
	type StreamCondition,
} from './herald.js'
import type ModuleInstance from './main.js'

const RED = combineRgb(204, 0, 0)
const GREEN = combineRgb(0, 153, 51)
const AMBER = combineRgb(230, 140, 0)
const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)

function dropdown(id: string, label: string, choices: DropdownChoice<string>[]) {
	return {
		type: 'dropdown' as const,
		id,
		label,
		choices,
		default: choices[0]?.id ?? '',
		allowCustom: true,
		minChoicesForSearch: 8,
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	const list = (kind: OptionKind): DropdownChoice<string>[] => choicesFor(kind, self.catalogOptions)
	const showing = (kind: ShowingKind, optionKind: OptionKind, label: string) => ({
		type: 'boolean' as const,
		name: `Screen is showing a ${label}`,
		description: `On while the screen reports it's showing this ${label}.`,
		defaultStyle: { bgcolor: GREEN, color: WHITE },
		options: [
			dropdown('device', 'Screen', list('device')),
			dropdown('item', label[0].toUpperCase() + label.slice(1), list(optionKind)),
		],
		callback: (fb: { options: Record<string, unknown> }) =>
			deviceShowing(self.state, optionText(fb.options.device, ''), kind, optionText(fb.options.item, '')),
	})

	const defs: CompanionFeedbackDefinitions = {
		override_active: {
			type: 'boolean',
			name: 'Emergency override is live',
			description: 'On while an override (or a particular one) is up.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [dropdown('override', 'Override', [{ id: ANY_OVERRIDE, label: 'Any override' }, ...list('override')])],
			callback: (fb) => overrideActive(self.state, optionText(fb.options.override, ANY_OVERRIDE)),
		},
		device_online: {
			type: 'boolean',
			name: 'Screen is online',
			description: 'On while the screen is checking in with Herald. Invert it to flag a dropped screen.',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			showInvert: true,
			options: [dropdown('device', 'Screen', list('device'))],
			callback: (fb) => self.state?.devices.find((d) => d.id === optionText(fb.options.device, ''))?.online === true,
		},
		device_power: {
			type: 'boolean',
			name: 'Screen power is…',
			description: 'Matches what the player last reported. "Off" includes standby.',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [
				dropdown('device', 'Screen', list('device')),
				dropdown('power', 'Power', [
					{ id: 'on', label: 'On' },
					{ id: 'off', label: 'Off' },
				]),
			],
			callback: (fb) =>
				devicePowerIs(self.state, optionText(fb.options.device, ''), fb.options.power === 'on' ? 'on' : 'off'),
		},
		device_showing_playlist: showing('playlist', 'playlist', 'playlist'),
		device_showing_stream: showing('stream', 'stream', 'stream'),
		device_showing_web_page: showing('web_page', 'web_page', 'web page'),
		device_showing_media: showing('media', 'media', 'media item'),
		stream_status: {
			type: 'boolean',
			name: 'Stream health is…',
			description: 'Healthy, having a problem, or idle (relay up, nobody watching).',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [
				dropdown('stream', 'Stream', list('stream')),
				dropdown('condition', 'Condition', [
					{ id: 'healthy', label: 'Healthy' },
					{ id: 'problem', label: 'Problem' },
					{ id: 'idle', label: 'Idle' },
				]),
			],
			callback: (fb) =>
				streamMatches(
					self.state?.streams.find((s) => s.id === optionText(fb.options.stream, ''))?.status,
					optionText(fb.options.condition, 'healthy') as StreamCondition,
				),
		},
		connected: {
			type: 'boolean',
			name: 'Connected to Herald',
			description: 'On while the last check-in with Herald worked. Invert it for a "lost Herald" warning.',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			showInvert: true,
			options: [],
			callback: () => self.connected,
		},
	}

	self.setFeedbackDefinitions(defs)
}
