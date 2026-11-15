import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  window.history.replaceState(null, '', '/#/memories')
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})
