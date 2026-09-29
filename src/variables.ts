import type { CompanionVariableDefinitions, CompanionVariableValues } from '@companion-module/base'
import type { HeraldState } from './herald.js'
import type ModuleInstance from './main.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const defs: CompanionVariableDefinitions = {
		override_active: { name: 'Emergency override live (true/false)' },
		override_name: { name: 'Name of the live override (blank when none)' },
		screens_online: { name: 'Screens online' },
		screens_total: { name: 'Screens in total' },
		streams_healthy: { name: 'Streams healthy' },
		last_update: { name: 'Time of the last successful check-in with Herald' },
	}
	self.setVariableDefinitions(defs)
}

export function variableValues(state: HeraldState, now = new Date()): CompanionVariableValues {
	return {
		override_active: state.override !== null,
		override_name: state.override?.name ?? '',
		screens_online: state.devices.filter((d) => d.online).length,
		screens_total: state.devices.length,
		streams_healthy: state.streams.filter((s) => s.status === 'healthy').length,
		last_update: now.toLocaleTimeString(),
	}
}
