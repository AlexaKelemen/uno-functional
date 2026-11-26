'use client'
// The only interactive part of the server-rendered /games page
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { selectIsLoggedIn } from '@/lib/redux/selectors'
import { joinGame } from '@/lib/redux/thunks/lobby'

export default function JoinButton({ gameId }: { gameId: string }) {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const loggedIn = useAppSelector(selectIsLoggedIn)

  const join = async () => {
    await dispatch(joinGame(gameId))
    router.push('/lobby')
  }

  return (
    <button disabled={!loggedIn} onClick={() => void join()}>
      Join
    </button>
  )
}
