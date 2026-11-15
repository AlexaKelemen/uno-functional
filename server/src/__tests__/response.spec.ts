import { describe, expect, it } from 'vitest'
import { ServerResponse } from '../response.js'

type NotFound = { readonly type: 'Not Found'; readonly key: string }

const notFound: NotFound = { type: 'Not Found', key: '7' }

function describeOutcome(response: ServerResponse<number, NotFound>): Promise<string> {
  return response.resolve({
    onSuccess: async (value) => `value ${value}`,
    onError: async (error) => `error ${error.type}`,
  })
}

describe('ServerResponse', () => {
  it('resolves a success with onSuccess', async () => {
    expect(await describeOutcome(ServerResponse.success(3))).toBe('value 3')
  })

  it('resolves a failure with onError', async () => {
    expect(await describeOutcome(ServerResponse.failure(notFound))).toBe('error Not Found')
  })

  it('chains with flatMap and stops at the first failure', async () => {
    const chained = await ServerResponse.success(3).flatMap(async (value) =>
      ServerResponse.success(value + 1),
    )
    expect(await describeOutcome(chained)).toBe('value 4')

    let called = false
    const stopped = await ServerResponse.failure(notFound).flatMap(async () => {
      called = true
      return ServerResponse.success(1)
    })
    expect(called).toBe(false)
    expect(await describeOutcome(stopped)).toBe('error Not Found')
  })

  it('turns a success into a failure when the filter rejects it', async () => {
    const positive = async (value: number) => value > 0
    const rejection = async (): Promise<NotFound> => ({ type: 'Not Found', key: 'negative' })

    const kept = await ServerResponse.success(3).filter(positive, rejection)
    expect(await describeOutcome(kept)).toBe('value 3')

    const rejected = await ServerResponse.success(-3).filter(positive, rejection)
    expect(await describeOutcome(rejected)).toBe('error Not Found')
  })

  it('processes only successes', async () => {
    const seen: number[] = []
    await ServerResponse.success(3).process(async (value) => {
      seen.push(value)
    })
    await ServerResponse.failure(notFound).process(async (value: number) => {
      seen.push(value)
    })
    expect(seen).toEqual([3])
  })
})
