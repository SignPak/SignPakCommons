import { createContext, useContext } from 'react'

export const RecordingContext = createContext(null)

export function useRecordings() {
  const value = useContext(RecordingContext)
  if (!value) throw new Error('useRecordings must be used inside <RecordingProvider>')
  return value
}
