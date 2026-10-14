import { createContext, useContext } from 'react'

export const UploadQueueContext = createContext(null)

export function useUploadQueue() {
  const value = useContext(UploadQueueContext)
  if (!value) throw new Error('useUploadQueue must be used inside <UploadQueueProvider>')
  return value
}
