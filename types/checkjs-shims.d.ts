declare module 'node:http' {
  const http: any;
  export default http;
}

declare module 'node:url' {
  export function pathToFileURL(path: string): URL;
}

declare module 'pino' {
  const pino: any;
  export default pino;
}
