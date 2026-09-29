import {
	combineRgb,
	type CompanionPresetDefinitions,
	type CompanionPresetSection,
	type CompanionSimplePresetDefinition,
} from '@companion-module/base'
import { END_LIVE_OVERRIDE } from './actions.js'
import { ANY_OVERRIDE } from './herald.js'
import type ModuleInstance from './main.js'

// Ready-made buttons, built from what this token can see: one per emergency
// override, an "end override" button, and on/off buttons per screen. Every
// one carries feedback, so it shows state as well as sending a command.

const RED = combineRgb(204, 0, 0)
const DARK_RED = combineRgb(90, 0, 0)
const GREEN = combineRgb(0, 153, 51)
const GREY = combineRgb(40, 40, 40)
const WHITE = combineRgb(255, 255, 255)

function button(text: string, bgcolor: number): CompanionSimplePresetDefinition['style'] {
	return { text, size: 'auto', color: WHITE, bgcolor, show_topbar: false }
}

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}
	const overrideIds: string[] = []
	const screenIds: string[] = []

	presets.end_override = {
		type: 'simple',
		name: 'End the live override',
		style: button('END\\nOVERRIDE', GREY),
		steps: [{ down: [{ actionId: END_LIVE_OVERRIDE, options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'override_active', options: { override: ANY_OVERRIDE }, style: { bgcolor: RED } }],
	}
	overrideIds.push('end_override')

	for (const o of self.catalogOptions?.override ?? []) {
		const id = `override_${o.id}`
		presets[id] = {
			type: 'simple',
			name: `Start "${o.name}"`,
			style: button(o.name, DARK_RED),
			steps: [{ down: [{ actionId: 'override_activate', options: { override: o.id } }], up: [] }],
			feedbacks: [{ feedbackId: 'override_active', options: { override: o.id }, style: { bgcolor: RED } }],
		}
		overrideIds.push(id)
	}

	for (const d of self.catalogOptions?.device ?? []) {
		for (const power of ['on', 'off'] as const) {
			const id = `power_${power}_${d.id}`
			presets[id] = {
				type: 'simple',
				name: `${d.name}: power ${power}`,
				style: button(`${d.name}\\n${power.toUpperCase()}`, GREY),
				steps: [{ down: [{ actionId: 'device_power', options: { device: d.id, power } }], up: [] }],
				feedbacks: [
					{
						feedbackId: 'device_power',
						options: { device: d.id, power },
						style: { bgcolor: power === 'on' ? GREEN : DARK_RED },
					},
				],
			}
			screenIds.push(id)
		}
	}

	const structure: CompanionPresetSection[] = [
		{ id: 'overrides', name: 'Emergency overrides', definitions: overrideIds },
		{ id: 'screens', name: 'Screen power', definitions: screenIds },
	]
	self.setPresetDefinitions(structure, presets)
}
