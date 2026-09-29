import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { HeraldClient, HeraldError } from './client.js'

interface Seen {
	method: string
	url: string
	headers: IncomingHttpHeaders
	body: string
}

describe('HeraldClient', () => {
	let server: Server
	let base: string
	let seen: Seen[]
	let reply: { status: number; body: string }

	beforeAll(async () => {
		server = createServer((req, res) => {
			let body = ''
			req.on('data', (c: Buffer) => (body += c.toString()))
			req.on('end', () => {
				seen.push({ method: req.method!, url: req.url!, headers: req.headers, body })
				res.writeHead(reply.status, { 'content-type': 'application/json' })
				res.end(reply.body)
			})
		})
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
	})

	afterAll(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()))
	})

	beforeEach(() => {
		seen = []
		reply = { status: 200, body: '{"ok":true}' }
	})

	it('reads state with the token, trimming a trailing slash off the URL', async () => {
		reply.body = JSON.stringify({ generated_at: 'x', override: null, devices: [], streams: [] })
		const state = await new HeraldClient(base, ' hrd_pat_abc ').state()
		expect(state.override).toBeNull()
		expect(seen[0]).toMatchObject({ method: 'GET', url: '/api/v1/integrations/state' })
		expect(seen[0].headers.authorization).toBe('Bearer hrd_pat_abc')
		expect(seen[0].headers['idempotency-key']).toBeUndefined()
	})

	it('sends a JSON body with a fresh idempotency key per press', async () => {
		const client = new HeraldClient(base, 'hrd_pat_abc')
		await client.send('POST', '/api/v1/devices/d1/power', { power: 'off' })
		await client.send('POST', '/api/v1/devices/d1/power', { power: 'off' })
		expect(JSON.parse(seen[0].body)).toEqual({ power: 'off' })
		expect(seen[0].headers['content-type']).toBe('application/json')
		const keys = seen.map((s) => s.headers['idempotency-key'])
		expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
		expect(keys[0]).not.toBe(keys[1])
	})

	it("turns Herald's errors into readable ones, and flags a refused token", async () => {
		reply = { status: 403, body: JSON.stringify({ error: { message: 'Activating overrides requires admin role.' } }) }
		const err = await new HeraldClient(base, 't').send('POST', '/x', {}).catch((e: unknown) => e)
		expect(err).toBeInstanceOf(HeraldError)
		expect((err as HeraldError).message).toBe('HTTP 403: Activating overrides requires admin role.')
		expect((err as HeraldError).unauthorized).toBe(false)

		reply = { status: 401, body: JSON.stringify({ error: 'unauthorized' }) }
		const auth = await new HeraldClient(base, 't').state().catch((e: unknown) => e)
		expect((auth as HeraldError).unauthorized).toBe(true)
	})

	it('reports an unreachable Herald with no status', async () => {
		const err = await new HeraldClient('http://127.0.0.1:1', 't').state().catch((e: unknown) => e)
		expect(err).toBeInstanceOf(HeraldError)
		expect((err as HeraldError).status).toBeNull()
		expect((err as HeraldError).message).toMatch(/^Couldn't reach Herald/)
	})

	it('says so when the URL points at something that is not Herald', async () => {
		reply = { status: 200, body: '<html>login</html>' }
		const err = await new HeraldClient(base, 't').state().catch((e: unknown) => e)
		expect((err as HeraldError).message).toMatch(/not JSON/)
	})
})
