import { createContext, useContext } from 'react'

export const LibraryContext = createContext(null)

export function useLibrary() {
  const value = useContext(LibraryContext)
  if (!value) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return value
}
