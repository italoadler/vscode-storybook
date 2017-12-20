// simplest way to make storybook middleware work with typescript ...
declare module '@storybook/react/dist/server/middleware' {
  import * as express from 'express';

  export function webpackValid(): Promise<void>;

  export default function(configDir: string): express.Router;
}
