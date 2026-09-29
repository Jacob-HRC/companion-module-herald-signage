import { randomUUID } from 'node:crypto'
import { errorMessage, type Catalog, type HeraldState } from './herald.js'

// Talks to Herald Cloud over HTTPS with a personal API token. Every call has
// a timeout: a Stream Deck button should fail visibly, not hang.

const TIMEOUT_MS = 10_000

export class HeraldError extends Error {
	constructor(
		message: string,
		readonly status: number | null,
	) {
		super(message)
	}

	/** 401: the token is wrong, revoked or expired. */
	get unauthorized(): boolean {
		return this.status === 401
	}
}

export class HeraldClient {
	readonly #base: string
	readonly #token: string

	constructor(baseUrl: string, token: string) {
		this.#base = baseUrl.trim().replace(/\/+$/, '')
		this.#token = token.trim()
	}

	async #request(method: string, path: string, body?: unknown): Promise<unknown> {
		let res: Response
		try {
			res = await fetch(`${this.#base}${path}`, {
				method,
				headers: {
					authorization: `Bearer ${this.#token}`,
					accept: 'application/json',
					...(body === undefined
						? {}
						: {
								'content-type': 'application/json',
								// One key per press: a retried request can't run twice.
								'idempotency-key': randomUUID(),
							}),
				},
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: AbortSignal.timeout(TIMEOUT_MS),
				redirect: 'error',
			})
		} catch (err) {
			const e = err as Error
			const reason = e.name === 'TimeoutError' ? `timed out after ${TIMEOUT_MS / 1000}s` : e.message
			throw new HeraldError(`Couldn't reach Herald: ${reason}`, null)
		}
		const text = await res.text()
		if (!res.ok) throw new HeraldError(errorMessage(res.status, text), res.status)
		try {
			return text ? JSON.parse(text) : null
		} catch {
			throw new HeraldError('Herald sent a response that is not JSON. Check the Herald URL.', res.status)
		}
	}

	async catalog(): Promise<Catalog> {
		return (await this.#request('GET', '/api/v1/integrations/catalog')) as Catalog
	}

	async state(): Promise<HeraldState> {
		return (await this.#request('GET', '/api/v1/integrations/state')) as HeraldState
	}

	async send(method: string, path: string, body: Record<string, unknown>): Promise<unknown> {
		return this.#request(method, path, body)
	}
}
