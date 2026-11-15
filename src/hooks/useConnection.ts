import { useEffect, useRef, useState } from 'react'
import {
  ACCESS_DENIED_EVENT,
  type AccessDeniedDetail,
  getAuthInfo,
  getHealth,
  isAbortError,
} from '../api/client'

export type ConnectionState =
  | { status: 'checking' }
  | { status: 'online'; auth: 'disabled' | 'unknown' }
  | { status: 'auth-required' }
  | { status: 'access-blocked'; reason: 'authentication' | 'access' }
  | { status: 'offline' }

export function useConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>({ status: 'checking' })
  const blockedRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    function onAccessDenied(event: Event): void {
      blockedRef.current = true
      const detail =
        event instanceof CustomEvent ? (event.detail as Partial<AccessDeniedDetail>) : null
      setState({
        status: 'access-blocked',
        reason: detail?.status === 401 ? 'authentication' : 'access',
      })
    }

    window.addEventListener(ACCESS_DENIED_EVENT, onAccessDenied)

    async function probe(): Promise<void> {
      const [healthResult, authResult] = await Promise.allSettled([
        getHealth(controller.signal),
        getAuthInfo(controller.signal),
      ])

      if (!active || controller.signal.aborted || blockedRef.current) return

      const authRequired =
        authResult.status === 'fulfilled' && authResult.value.authEnabled === true

      if (authRequired) {
        setState({ status: 'auth-required' })
        return
      }

      const healthOk =
        healthResult.status === 'fulfilled' && healthResult.value.status === 'healthy'

      if (!healthOk) {
        setState({ status: 'offline' })
        return
      }

      setState({
        status: 'online',
        auth: authResult.status === 'fulfilled' ? 'disabled' : 'unknown',
      })
    }

    probe().catch((error: unknown) => {
      if (active && !isAbortError(error)) setState({ status: 'offline' })
    })

    return () => {
      active = false
      controller.abort()
      window.removeEventListener(ACCESS_DENIED_EVENT, onAccessDenied)
    }
  }, [])

  return state
}
