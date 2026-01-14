import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { ConfigProvider, theme as antTheme } from 'antd'
import zhTW from 'antd/locale/zh_TW'

type ThemeMode = 'light' | 'dark'

interface ThemeContextType {
  mode: ThemeMode
  toggleTheme: () => void
  setTheme: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'ragicedp-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    return 'dark' // 預設深色模式
  })

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode)
  }

  // Ant Design Minimalist Theme
  const antConfig = {
    algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#000000',
      colorSuccess: '#16A34A',
      colorWarning: '#D97706',
      colorError: '#DC2626',
      colorInfo: '#2563EB',
      borderRadius: 6,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      colorBgContainer: mode === 'dark' ? '#0A0A0A' : '#FFFFFF',
      colorBgElevated: mode === 'dark' ? '#141414' : '#FFFFFF',
      colorBorder: mode === 'dark' ? '#262626' : '#E5E5E5',
      colorText: mode === 'dark' ? '#FAFAFA' : '#000000',
      colorTextSecondary: mode === 'dark' ? '#A3A3A3' : '#666666',
    },
    components: {
      Card: {
        colorBgContainer: mode === 'dark' ? '#0A0A0A' : '#FFFFFF',
      },
      Table: {
        colorBgContainer: 'transparent',
        headerBg: mode === 'dark' ? '#141414' : '#FAFAFA',
      },
      Menu: {
        colorBgContainer: 'transparent',
        // Fixed: Use new token names instead of deprecated ones
        itemSelectedBg: mode === 'dark' ? '#141414' : '#FAFAFA',
        itemSelectedColor: mode === 'dark' ? '#FAFAFA' : '#000000',
      },
      Button: {
        borderRadius: 6,
        primaryColor: mode === 'dark' ? '#0A0A0A' : '#FFFFFF',
      },
      Select: {
        borderRadius: 6,
      },
      Input: {
        borderRadius: 6,
      },
    },
  }

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setTheme }}>
      <ConfigProvider locale={zhTW} theme={antConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
