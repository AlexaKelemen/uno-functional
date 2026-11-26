// Root layout: a server component. It wraps every page in the Redux store
// provider (a client component), so client-side navigation keeps the store.
import type { Metadata } from 'next'
import StoreProvider from './StoreProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'UNO',
  description: 'UNO with a functional model, React, Redux, RxJS and Next.js',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  )
}
