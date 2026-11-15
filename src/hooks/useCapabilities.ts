import { useCallback, useEffect, useState } from 'react'
import { getCapabilities, isAbortError } from '../api/client'
import type { CapabilitySet } from '../api/types'

export type CapabilityState =
  | { status: 'loading' }
  | { status: 'ready'; capabilities: CapabilitySet }
  | { status: 'unknown'; message: string }

export type FeatureState = 'loading' | 'enabled' | 'disabled' | 'unknown'

const FEATURE_KEYS = {
  planning: 'planning',
  skills: 'skills',
  files: 'files',
  activity: 'activityStream',
} as const

export function featureState(
  state: CapabilityState,
  feature: keyof typeof FEATURE_KEYS,
): FeatureState {
  if (state.status === 'loading') return 'loading'
  if (state.status === 'unknown') return 'unknown'
  const value = state.capabilities[FEATURE_KEYS[feature]]
  if (value === true) return 'enabled'
  if (value === false) return 'disabled'
  return 'unknown'
}

export function useCapabilities(enabled = true): {
  state: CapabilityState
  retry: () => void
} {
  const [state, setState] = useState<CapabilityState>({ status: 'loading' })
  const [token, setToken] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: token/enabled trigger a retry
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'loading' })
      return
    }
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })
    getCapabilities(controller.signal)
      .then((capabilities) => {
        if (!active || controller.signal.aborted) return
        if (capabilities.schemaVersion !== 1) {
          setState({ status: 'unknown', message: 'Capability discovery schema is unsupported.' })
          return
        }
        setState({ status: 'ready', capabilities })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return
        setState({
          status: 'unknown',
          message: error instanceof Error ? error.message : 'Capability discovery failed.',
        })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [token, enabled])

  const retry = useCallback(() => setToken((value) => value + 1), [])
  return { state, retry }
}
