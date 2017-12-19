declare module '@storybook/react/server' {
  export interface Closeable {
    close(): void;
  }

  export interface Options {
    port: number;
    host?: string;
    staticDir?: string;
    configDir?: string;
    https?: boolean;
    sslCa?: string[];
    sslCert?: string;
    sslKey?: string;
  }

  export function startServer(program: Options): Promise<Closeable>;
}
