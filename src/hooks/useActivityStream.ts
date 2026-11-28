import { useEffect, useRef, useState } from 'react'
import { activityStreamUrl } from '../api/client'
import type { ActivityEventRecord } from '../api/types'

export type ActivityStreamStatus = 'disabled' | 'paused' | 'connecting' | 'live' | 'reconnecting'

export interface UseActivityStreamParams {
  enabled: boolean
  paused: boolean
  entityType?: string
  action?: string
  onEvent: (event: ActivityEventRecord) => void
  onGap?: () => void
}

export function useActivityStream({
  enabled,
  paused,
  entityType,
  action,
  onEvent,
  onGap,
}: UseActivityStreamParams): ActivityStreamStatus {
  const [status, setStatus] = useState<ActivityStreamStatus>(
    !enabled ? 'disabled' : paused ? 'paused' : 'connecting',
  )
  const onEventRef = useRef(onEvent)
  const onGapRef = useRef(onGap)
  onEventRef.current = onEvent
  onGapRef.current = onGap

  useEffect(() => {
    if (!enabled || paused || typeof EventSource === 'undefined') {
      setStatus(!enabled ? 'disabled' : 'paused')
      return
    }

    setStatus('connecting')
    const lastSeqRef = { current: null as number | null }
    const url = activityStreamUrl({ entityType, action })
    const source = new EventSource(url)

    const handleOpen = () => {
      setStatus('live')
    }

    const handleError = () => {
      setStatus('reconnecting')
    }

    const handleActivity = (message: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(message.data) as ActivityEventRecord
        if (typeof parsed.seq === 'number') {
          if (lastSeqRef.current !== null && parsed.seq > lastSeqRef.current + 1) {
            onGapRef.current?.()
          }
          lastSeqRef.current = parsed.seq
        }
        onEventRef.current(parsed)
      } catch {
        // Ignore malformed SSE frames.
      }
    }

    source.addEventListener('open', handleOpen)
    source.addEventListener('error', handleError)
    source.addEventListener('activity', handleActivity)

    return () => {
      source.removeEventListener('open', handleOpen)
      source.removeEventListener('error', handleError)
      source.removeEventListener('activity', handleActivity)
      source.close()
    }
  }, [enabled, paused, entityType, action])

  return status
}
