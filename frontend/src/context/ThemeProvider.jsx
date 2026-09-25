import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './ThemeContext'

const STORAGE_KEY = 'signpak:theme'
const META_COLOR = { light: '#f3faf6', dark: '#00401a' }

const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
const savedChoice = () => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch { return null }
}

/**
 * Light or dark. Until the visitor picks one, the theme follows their operating system (and
 * keeps following it if it changes). Once they pick, their choice is remembered on this device.
 * index.html applies the same rule before first paint; this provider takes over from there.
 */
export default function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(savedChoice) // null means "follow the system"
  const [system, setSystem] = useState(systemTheme)
  const theme = choice ?? system

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return undefined
    const onChange = (event) => setSystem(event.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme])
  }, [theme])

  const setTheme = useCallback((next) => {
    setChoice(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* private mode: the choice just will not persist */ }
  }, [])
  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
