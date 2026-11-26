// "/lobby" - waiting for an online game to start. Static shell: which lobby
// you are in is only known in the browser (Redux store, live server pushes
// through RxJS), so all of it is in the client component.
import LobbyView from '@/components/views/LobbyView'

export default function LobbyPage() {
  return <LobbyView />
}
