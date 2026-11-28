import { vi } from 'vitest'

type Listener = (event: Event) => void

export interface MockEventSourceInstance {
  url: string
  closed: boolean
  addEventListener: (type: string, listener: Listener) => void
  removeEventListener: (type: string, listener: Listener) => void
  close: () => void
  dispatch: (type: string, data?: string) => void
}

let instances: MockEventSourceInstance[] = []

export function installEventSourceMock(): {
  instances: MockEventSourceInstance[]
  last: () => MockEventSourceInstance | undefined
} {
  instances = []

  class MockEventSource {
    url: string
    closed = false
    private readonly listeners = new Map<string, Set<Listener>>()

    constructor(url: string) {
      this.url = url
      const instance: MockEventSourceInstance = {
        url,
        closed: false,
        addEventListener: (type, listener) => {
          let bucket = this.listeners.get(type)
          if (!bucket) {
            bucket = new Set()
            this.listeners.set(type, bucket)
          }
          bucket.add(listener)
        },
        removeEventListener: (type, listener) => {
          this.listeners.get(type)?.delete(listener)
        },
        close: () => {
          this.closed = true
          instance.closed = true
        },
        dispatch: (type, data) => {
          const event = new MessageEvent(type, { data })
          const bucket = this.listeners.get(type)
          if (!bucket) return
          for (const listener of bucket) {
            listener(event)
          }
        },
      }
      instances.push(instance)
      Object.assign(this, instance)
    }
  }

  vi.stubGlobal('EventSource', MockEventSource)
  return {
    get instances() {
      return instances
    },
    last() {
      return instances.at(-1)
    },
  }
}
