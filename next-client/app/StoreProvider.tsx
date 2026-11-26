'use client'
// One Redux store per browser (and a fresh, empty one for each server render).
// The store is made in a ref, so it survives re-renders, and the session is
// restored in an effect: the first client render must match the server's HTML,
// which was rendered without anybody logged in.
import { useEffect, useState, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { createConnection } from '@/lib/api/connection'
import { makeStore, type AppStore } from '@/lib/redux/store'
import { restoreSession } from '@/lib/redux/thunks/session'

export default function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState<AppStore>(() => makeStore(createConnection()))

  useEffect(() => {
    store.dispatch(restoreSession())
  }, [store])

  return <Provider store={store}>{children}</Provider>
}
