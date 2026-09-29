import type { CompanionActionDefinitions, SomeCompanionActionInputField } from '@companion-module/base'
import { buildRequest, choicesFor, companionActionId, mergeActions, optionText, type CatalogAction } from './herald.js'
import type ModuleInstance from './main.js'

/** Not in Herald's catalog: ends whichever override is live, whatever it's called. */
export const END_LIVE_OVERRIDE = 'end_live_override'

function optionsFor(action: CatalogAction, self: ModuleInstance): SomeCompanionActionInputField[] {
	return action.params.map((p) => {
		const choices =
			p.kind === 'choice'
				? (p.choices ?? []).map((c) => ({ id: c.value, label: c.label }))
				: choicesFor(p.kind, self.catalogOptions)
		return {
			type: 'dropdown',
			id: p.key,
			label: p.label,
			choices,
			default: choices[0]?.id ?? '',
			// Keeps a saved id working while Herald is unreachable and the list is empty.
			allowCustom: true,
			minChoicesForSearch: 8,
		}
	})
}

export function UpdateActions(self: ModuleInstance): void {
	const defs: CompanionActionDefinitions = {}

	for (const action of mergeActions(self.liveActions)) {
		defs[companionActionId(action.id)] = {
			name: action.name,
			description: action.description,
			options: optionsFor(action, self),
			callback: async (event) => {
				const values: Record<string, string> = {}
				for (const p of action.params) values[p.key] = optionText(event.options[p.key])
				const req = buildRequest(action, values)
				if (!req.ok) {
					self.log('warn', `${action.name}: choose ${req.missing.join(', ')} on the button first.`)
					return
				}
				await self.run(action.name, req.method, req.path, req.body)
			},
		}
	}

	defs[END_LIVE_OVERRIDE] = {
		name: 'End the live emergency override',
		description: 'Clears whichever override is up. Does nothing when none is. Needs an admin token.',
		options: [],
		callback: async () => {
			const live = self.state?.override
			if (!live) {
				self.log('info', 'No emergency override is live, so there was nothing to end.')
				return
			}
			await self.run(`End "${live.name}"`, 'POST', `/api/v1/overrides/${encodeURIComponent(live.id)}/clear`, {})
		},
	}

	self.setActionDefinitions(defs)
}
