type FetchHandler = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>;

export function mockFetch(handler: FetchHandler): typeof fetch {
  const fetchMock = ((input, init) => handler(input, init)) as typeof fetch;
  fetchMock.preconnect = () => {};
  return fetchMock;
}
