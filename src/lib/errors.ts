export class OfflineError extends Error {
  constructor() {
    super('offline')
    this.name = 'OfflineError'
  }
}

export function isOfflineError(error: unknown): error is OfflineError {
  return error instanceof OfflineError
}
