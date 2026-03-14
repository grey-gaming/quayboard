export const createSseConnection = (path: string) =>
  new EventSource(path, { withCredentials: true });
