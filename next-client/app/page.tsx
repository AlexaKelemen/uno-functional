// "/" - the setup screen. Static: there is no data to fetch and no run-time
// API is used, so `next build` prerenders it to HTML once. The form itself
// is a client component, which is hydrated in the browser.
import Link from 'next/link'
import SetupView from '@/components/views/SetupView'

export default function SetupPage() {
  return (
    <>
      <SetupView />
      <nav className="pageLinks">
        <Link href="/games">Open lobbies</Link>
        <Link href="/rules">Rules</Link>
      </nav>
    </>
  )
}
