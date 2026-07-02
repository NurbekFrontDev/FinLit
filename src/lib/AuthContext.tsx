import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

type AuthContextType = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // Фикс бага: после возврата в приложение (на телефоне было свёрнуто несколько
  // минут) принудительно перечитываем сессию из хранилища. WebView иногда теряет
  // состояние в памяти, и без этого показывался экран входа, хотя токен ещё валиден.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let handle: { remove: () => void } | undefined
    ;(async () => {
      try {
        const { App } = await import('@capacitor/app')
        const h = await App.addListener('resume', async () => {
          try {
            const { data } = await supabase.auth.getSession()
            if (data.session) setSession(data.session)
          } catch {
            // не критично
          }
        })
        handle = h
      } catch {
        // не критично
      }
    })()
    return () => handle?.remove()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return ctx
}
