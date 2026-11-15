// A bot runs in its own Web Worker and communicates ONLY through postMessage/onmessage.
// The messages are plain data (see shared/gameTypes.ts), so the same protocol can
// later travel over the network when the bots move to the server.
import type { BotRequest, BotResponse } from '@/shared/gameTypes'
import { chooseAction, considerUnoAccusation } from './botStrategy'

function respond(request: BotRequest): BotResponse {
  switch (request.type) {
    case 'chooseAction':
      return { requestId: request.requestId, action: chooseAction(request.view) }
    case 'considerUnoAccusation':
      return {
        requestId: request.requestId,
        action: considerUnoAccusation(request.playerWithOneCard),
      }
  }
}

self.onmessage = ({ data }: MessageEvent<BotRequest>) => {
  self.postMessage(respond(data))
}
