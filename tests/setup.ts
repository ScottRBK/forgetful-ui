import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, vi } from 'vitest'

beforeAll(() => {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

beforeEach(() => {
  window.history.replaceState(null, '', '/#/memories')
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})
