'use client'

import { useState, useCallback } from 'react'
import type { ServiceResult, AsyncState } from '@/types'

export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(
    async (fn: () => Promise<ServiceResult<T>>) => {
      setState(prev => ({ ...prev, loading: true, error: null }))
      const result = await fn()
      setState({
        data: result.data,
        loading: false,
        error: result.error,
      })
      return result
    },
    []
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, execute, reset }
}
