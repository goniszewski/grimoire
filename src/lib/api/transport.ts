export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const defaultFetch: FetchImplementation = (input, init) => globalThis.fetch(input, init);

let fetchImpl: FetchImplementation = defaultFetch;

export const transport = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return fetchImpl(input, init);
  },
};

export function setFetchImplementation(next: FetchImplementation): () => void {
  const previous = fetchImpl;
  fetchImpl = next;
  return () => {
    fetchImpl = previous;
  };
}

export function resetFetchImplementation(): void {
  fetchImpl = defaultFetch;
}
