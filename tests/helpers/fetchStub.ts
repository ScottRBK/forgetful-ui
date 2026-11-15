import { vi } from 'vitest'

export interface StubRequest {
  url: URL
  method: string
  signal: AbortSignal | null
}

export type StubHandler = (request: StubRequest) => Response | Promise<Response>

export interface RouteStub {
  match: RegExp | string
  handler: StubHandler
}

export interface FetchStub {
  requests: StubRequest[]
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function installFetchStub(routes: RouteStub[]): FetchStub {
  const requests: StubRequest[] = []

  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(rawUrl, window.location.origin)
    const request: StubRequest = {
      url,
      method: init?.method ?? 'GET',
      signal: init?.signal ?? null,
    }
    requests.push(request)

    const route = routes.find((candidate) =>
      typeof candidate.match === 'string'
        ? url.pathname === candidate.match
        : candidate.match.test(url.pathname),
    )

    if (!route) {
      throw new Error(`Unexpected fetch: ${request.method} ${url.pathname}${url.search}`)
    }

    return route.handler(request)
  })

  vi.stubGlobal('fetch', stub)
  return { requests }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
