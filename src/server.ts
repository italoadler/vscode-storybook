/*
 * this process is executed from workspace directory and requires, that
 * workspace have installed all packages described in projectPackages.
 */
import * as fs from 'fs';
import { Server } from 'http';
import * as path from 'path';

// info about packages, that are loaded from projects node_modules directory ...
const projectPackages = {
  express: 'express',
  shelljs: 'shelljs',
  storybook: '@storybook/react/dist/server/middleware.js',
};

type ProjectPackages = { [P in keyof typeof projectPackages]: any };

export enum ServerState {
  STOPPED = 'STOPED',
  STARTING = 'STARTING',
  LISTENING = 'LISTENING',
  ERROR = 'ERROR',
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

function fatalError(error: any): never {
  console.error('ERROR: ' + error);
  setState(ServerState.ERROR);
  return process.exit(1);
}

/**
 * gets path to packages installed in project dir and ensure that these packages
 * actually exists.
 * @param rootPath project root path @see vscode.workspace.rootpath
 */
function checkPackages(rootPath: string): ProjectPackages {
  return Object.keys(projectPackages).reduce(
    (result, key) => {
      const packagePath = path.resolve(
        rootPath,
        'node_modules',
        projectPackages[key],
      );

      if (!fs.existsSync(packagePath)) {
        fatalError(`Error: Cannot find module '${key}' at ${packagePath} .`);
      }

      result[key] = require(packagePath);
      return result;
    },
    {} as ProjectPackages,
  );
}

function start(config: Config) {
  process.chdir(config.rootPath);

  const { express, shelljs, storybook } = checkPackages(config.rootPath);

  if (serverState !== ServerState.STOPPED) {
    fatalError('Server is not stopped.');
  }

  setState(ServerState.STARTING);

  const app = express();

  if (config.staticDirs) {
    config.staticDirs.forEach(dir => {
      const staticPath = path.resolve(config.rootPath, dir);
      if (!fs.existsSync(staticPath)) {
        console.warn(
          'WARN: no such directory to load static files: ' + staticPath,
        );
      } else {
        console.log(`=> Loading static files from: ${staticPath} .`);
        app.use(express.static(staticPath, { index: false }));
      }
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

  app.use(storybook.default(configDir));

  const webpackSuccess = (storybook.webpackValid as Promise<any>).catch(
    error => {
      fatalError('WEBPACK compilation error');
    },
  );

  const serverStart = new Promise((resolve, reject) => {
    const server = app.listen(config.port, error => {
      if (error) {
        reject(error);
      } else {
        listener = server;
        resolve();
      }
    });
  });

  Promise.all([webpackSuccess, serverStart]).then(
    () => {
      const address = `http://localhost:${config.port}/`;
      console.log(`Storybook started on => ${address}`);
      setState(ServerState.LISTENING);
    },
    error => {
      fatalError(error);
    },
  );
}

// process is waiting for this message from parent before starting server so
// parent can assign event listeners before real work starts ...
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
