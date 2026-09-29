import { InstanceBase, InstanceStatus, type InstanceTypes, type SomeCompanionConfigField } from '@companion-module/base'
import { UpdateActions } from './actions.js'
import { HeraldClient, HeraldError } from './client.js'
import { DEFAULT_POLL_SECONDS, GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpdateFeedbacks } from './feedbacks.js'
import type { CatalogAction, CatalogOptions, HeraldState } from './herald.js'
import { UpdatePresets } from './presets.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateVariableDefinitions, variableValues } from './variables.js'

export { UpgradeScripts }

/** How often the catalog (dropdown names, new actions) is re-read. */
const CATALOG_REFRESH_MS = 5 * 60_000

type ModuleSchema = {
	config: ModuleConfig
	secrets: ModuleSecrets
	// Actions and feedbacks are defined from Herald's catalog at runtime, so
	// their ids aren't known statically.
	actions: InstanceTypes['actions']
	feedbacks: InstanceTypes['feedbacks']
	variables: InstanceTypes['variables']
}

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig
	client: HeraldClient | null = null
	/** The live catalog's actions, or null until it's been read once. */
	liveActions: CatalogAction[] | null = null
	catalogOptions: CatalogOptions | null = null
	state: HeraldState | null = null
	connected = false

	#pollTimer: NodeJS.Timeout | null = null
	#catalogTimer: NodeJS.Timeout | null = null
	#polling = false
	#pollAgain = false

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		await this.configUpdated(config, secrets)
	}

	async destroy(): Promise<void> {
		this.#stop()
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.#stop()
		const url = (config.url ?? '').trim()
		const token = (secrets?.token ?? '').trim()
		if (!/^https?:\/\/[^\s/]+/.test(url) || !token) {
			this.client = null
			this.updateStatus(InstanceStatus.BadConfig, 'Enter your Herald URL and an API token.')
			return
		}
		this.client = new HeraldClient(url, token)
		this.updateStatus(InstanceStatus.Connecting)
		await this.refreshCatalog()
		await this.poll()
		const seconds = Math.min(60, Math.max(1, Number(config.poll_seconds) || DEFAULT_POLL_SECONDS))
		this.#pollTimer = setInterval(() => void this.poll(), seconds * 1000)
		this.#catalogTimer = setInterval(() => void this.refreshCatalog(), CATALOG_REFRESH_MS)
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	#stop(): void {
		if (this.#pollTimer) clearInterval(this.#pollTimer)
		if (this.#catalogTimer) clearInterval(this.#catalogTimer)
		this.#pollTimer = null
		this.#catalogTimer = null
	}

	#fail(err: unknown): void {
		const e = err instanceof HeraldError ? err : new HeraldError((err as Error).message, null)
		if (this.connected || e.unauthorized) this.log('warn', e.message)
		this.connected = false
		if (e.unauthorized) {
			this.updateStatus(
				InstanceStatus.AuthenticationFailure,
				"Herald refused the API token. Check it hasn't been revoked or expired.",
			)
		} else if (e.status === null) {
			this.updateStatus(InstanceStatus.ConnectionFailure, e.message)
		} else {
			this.updateStatus(InstanceStatus.UnknownError, e.message)
		}
		this.checkFeedbacks('connected')
	}

	/** Re-read the catalog and rebuild everything that shows its names. */
	async refreshCatalog(): Promise<void> {
		if (!this.client) return
		try {
			const catalog = await this.client.catalog()
			this.liveActions = catalog.actions
			this.catalogOptions = catalog.options
			this.updateActions()
			this.updateFeedbacks()
			this.updatePresets()
		} catch (err) {
			this.#fail(err)
		}
	}

	/**
	 * Fetch state, light the buttons, set the variables. A call made while one
	 * is in flight runs once more afterwards, so a button press is never left
	 * waiting for the next interval.
	 */
	async poll(): Promise<void> {
		if (!this.client) return
		if (this.#polling) {
			this.#pollAgain = true
			return
		}
		this.#polling = true
		try {
			do {
				this.#pollAgain = false
				this.state = await this.client.state()
				if (!this.connected) this.log('info', 'Connected to Herald.')
				this.connected = true
				this.updateStatus(InstanceStatus.Ok)
				this.setVariableValues(variableValues(this.state))
				this.checkAllFeedbacks()
			} while (this.#pollAgain)
		} catch (err) {
			this.#fail(err)
		} finally {
			this.#polling = false
		}
	}

	/** Run one API request for a button press, then refresh so the button shows the result. */
	async run(what: string, method: string, path: string, body: Record<string, unknown>): Promise<void> {
		if (!this.client) {
			this.log('warn', `${what}: set up the Herald URL and API token first.`)
			return
		}
		try {
			await this.client.send(method, path, body)
			this.log('info', `${what}: done.`)
		} catch (err) {
			const e = err as HeraldError
			const hint = e.status === 403 ? " The API token's owner may not have the role or access this needs." : ''
			this.log('error', `${what}: ${e.message.replace(/\.$/, '')}.${hint}`)
			if (e.status === null || e.unauthorized) this.#fail(e)
		}
		await this.poll()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}
