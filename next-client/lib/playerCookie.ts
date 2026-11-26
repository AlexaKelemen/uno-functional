// The player's name as a cookie, so the Next.js server knows who is asking
// when it renders a page (see app/game/[id]/page.tsx and app/games/page.tsx).
// The server reads it with next/headers' cookies(); the browser with document.cookie.
export const playerCookieName = 'uno-player'

export function readPlayerCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const entry = document.cookie.split('; ').find((c) => c.startsWith(`${playerCookieName}=`))
  return entry === undefined ? undefined : decodeURIComponent(entry.slice(playerCookieName.length + 1))
}

export function writePlayerCookie(name: string | undefined) {
  if (typeof document === 'undefined') return
  document.cookie =
    name === undefined
      ? `${playerCookieName}=; path=/; max-age=0; samesite=lax`
      : `${playerCookieName}=${encodeURIComponent(name)}; path=/; max-age=86400; samesite=lax`
}
