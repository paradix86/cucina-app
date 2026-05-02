export class AdapterDomainMismatchError extends Error {
  constructor(adapterName: string, hostname: string) {
    super(`Adapter ${adapterName} does not handle hostname ${hostname}`);
    this.name = 'AdapterDomainMismatchError';
  }
}

export function isAdapterDomainMismatchError(err: unknown): err is AdapterDomainMismatchError {
  return err instanceof Error && err.name === 'AdapterDomainMismatchError';
}
