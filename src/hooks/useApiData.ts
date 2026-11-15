import { useEffect, useRef, useState } from 'react'
import { ApiError, isAbortError } from '../api/client'

export type ApiDataState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string; httpStatus: number | null }

export function useApiData<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
): { state: ApiDataState<T>; retry: () => void } {
  const [state, setState] = useState<ApiDataState<T>>(
    enabled ? { status: 'loading' } : { status: 'idle' },
  )
  const [token, setToken] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  // biome-ignore lint/correctness/useExhaustiveDependencies: key and token trigger a reload
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' })
      return
    }

    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })
    loadRef
      .current(controller.signal)
      .then((data) => {
        if (!active || controller.signal.aborted) return
        setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'The request failed.',
          httpStatus: error instanceof ApiError ? error.status : null,
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [key, enabled, token])

  return { state, retry: () => setToken((value) => value + 1) }
}
