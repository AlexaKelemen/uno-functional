export type ResponseHandlers<Value, Failure, Result> = {
  readonly onSuccess: (value: Value) => Promise<Result>
  readonly onError: (error: Failure) => Promise<Result>
}

export interface ServerResponse<Value, Failure> {
  resolve<Result>(handlers: ResponseHandlers<Value, Failure, Result>): Promise<Result>
  process(onSuccess: (value: Value) => Promise<unknown>): Promise<void>
  flatMap<Mapped, OtherFailure>(
    transform: (value: Value) => Promise<ServerResponse<Mapped, OtherFailure>>,
  ): Promise<ServerResponse<Mapped, Failure | OtherFailure>>
  filter<OtherFailure>(
    predicate: (value: Value) => Promise<boolean>,
    toFailure: (value: Value) => Promise<OtherFailure>,
  ): Promise<ServerResponse<Value, Failure | OtherFailure>>
}

class SuccessResponse<Value> implements ServerResponse<Value, never> {
  private readonly value: Value

  constructor(value: Value) {
    this.value = value
  }

  resolve<Result>({ onSuccess }: ResponseHandlers<Value, never, Result>): Promise<Result> {
    return onSuccess(this.value)
  }

  async process(onSuccess: (value: Value) => Promise<unknown>): Promise<void> {
    await onSuccess(this.value)
  }

  flatMap<Mapped, OtherFailure>(
    transform: (value: Value) => Promise<ServerResponse<Mapped, OtherFailure>>,
  ): Promise<ServerResponse<Mapped, OtherFailure>> {
    return transform(this.value)
  }

  async filter<OtherFailure>(
    predicate: (value: Value) => Promise<boolean>,
    toFailure: (value: Value) => Promise<OtherFailure>,
  ): Promise<ServerResponse<Value, OtherFailure>> {
    if (await predicate(this.value)) return this
    return new FailureResponse(await toFailure(this.value))
  }
}

class FailureResponse<Failure> implements ServerResponse<never, Failure> {
  private readonly error: Failure

  constructor(error: Failure) {
    this.error = error
  }

  resolve<Result>({ onError }: ResponseHandlers<never, Failure, Result>): Promise<Result> {
    return onError(this.error)
  }

  async process(): Promise<void> {}

  async flatMap<Mapped, OtherFailure>(): Promise<ServerResponse<Mapped, Failure | OtherFailure>> {
    return this
  }

  async filter<OtherFailure>(): Promise<ServerResponse<never, Failure | OtherFailure>> {
    return this
  }
}

export const ServerResponse = {
  success<Value>(value: Value): ServerResponse<Value, never> {
    return new SuccessResponse(value)
  },
  failure<Failure>(error: Failure): ServerResponse<never, Failure> {
    return new FailureResponse(error)
  },
} as const
