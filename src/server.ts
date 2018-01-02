/*
 * this process is executed from workspace directory and requires, that
 * workspace have installed '@storybook/react' package
 */
import * as express from 'express';
import * as fs from 'fs';
import { Server } from 'http';
import * as path from 'path';
import * as shelljs from 'shelljs';

enum ServerState {
  STOPPED = 'STOPED',
  STARTING = 'STARTING',
  LISTENING = 'LISTENING',
}

interface Config {
  rootPath: string;
  port: number;
  staticDirs: string[];
  configDir: string;
}

let listener: Server;
let serverState: ServerState = ServerState.STOPPED;

function setState(state: ServerState) {
  serverState = state;
  process.send({ state });
}

function start(config: Config) {
  process.chdir(config.rootPath);

  const middlewarePath = path.resolve(
    config.rootPath,
    'node_modules',
    // this may be changed in the future by @storybook/react team ...
    '@storybook/react/dist/server/middleware.js',
  );

  if (!fs.existsSync(middlewarePath)) {
    console.error(
      `ERROR: Cannot find @storybook/react middleware at ${middlewarePath} .`,
    );

    process.exit(1);
  }

  if (serverState !== ServerState.STOPPED) {
    console.error('ERROR: Server is not stopped.');
    process.exit(1);
  }

  setState(ServerState.STARTING);

  const app = express();

  if (config.staticDirs) {
    config.staticDirs.forEach(dir => {
      const staticPath = path.resolve(config.rootPath, dir);
      if (!fs.existsSync(staticPath)) {
        console.error(
          'ERROR: no such directory to load static files: ' + staticPath,
        );
        process.exit(1);
      }

      console.log(`=> Loading static files from: ${staticPath} .`);
      app.use(express.static(staticPath, { index: false }));
    });
  }

  // The repository info is sent to the storybook while running on
  // development mode so it'll be easier for tools to integrate.
  const exec = cmd => shelljs.exec(cmd, { silent: true }).stdout.trim();
  process.env.STORYBOOK_GIT_ORIGIN =
    process.env.STORYBOOK_GIT_ORIGIN || exec('git remote get-url origin');
  process.env.STORYBOOK_GIT_BRANCH =
    process.env.STORYBOOK_GIT_BRANCH || exec('git symbolic-ref HEAD --short');

  // NOTE: changes to env should be done before calling `getBaseConfig`
  // function which is called inside the middleware
  const configDir = path.join(config.rootPath, config.configDir);

  // import from project node_modules, not from extension node_modules
  const { default: storybook, webpackValid } = require(middlewarePath);

  app.use(storybook(configDir));

  const serverListening = new Promise((resolve, reject) => {
    const server = app.listen(config.port, error => {
      if (error) {
        reject(error);
      } else {
        listener = server;
        resolve();
      }
    });
  });

  Promise.all([webpackValid, serverListening])
    .then(() => {
      const address = `http://localhost:${config.port}/`;
      console.log(`Storybook started on => ${address}`);
      setState(ServerState.LISTENING);
    })
    .catch(error => {
      console.error('ERROR: ' + error);
      process.exit(1);
    });
}

// process is waiting for this message from parent before starting server so
// parent can assign event listeners ...
process.on('message', start);

// kill yourself message from parent :o)
process.on('SIGTERM', () => {
  if (listener) {
    listener.close(() => {
      process.exit();
    });
    listener = undefined;
  }
});
