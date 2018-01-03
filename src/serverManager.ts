import { ChildProcess, fork } from 'child_process';
import * as path from 'path';
import { throttle } from 'throttle-debounce';
import * as vscode from 'vscode';
import config from './config';

export enum ServerState {
  STOPPED = 'STOPED',
  STARTING = 'STARTING',
  LISTENING = 'LISTENING',
  ERROR = 'ERROR',
}

/**
 * Helper class used for spawning storybook server.
 */
export class ServerManager {
  private state: ServerState;
  private child: ChildProcess;
  private eventEmmiter: vscode.EventEmitter<void>;
  private log: string;
  private throttledEvent: () => void;

  constructor() {
    this.state = ServerState.STOPPED;
    this.eventEmmiter = new vscode.EventEmitter<void>();
    this.log = '';

    this.throttledEvent = throttle(50, () => {
      this.eventEmmiter.fire();
    });
  }

  get serverState() {
    return this.state;
  }

  get onLog() {
    return this.eventEmmiter.event;
  }

  get logLines() {
    return this.log.slice();
  }

  prepareStart() {
    if (this.child) {
      this.stopServer();
    }

    this.log = 'Starting storybook server ...\n';
    this.state = ServerState.STARTING;
  }

  startServer() {
    const server = path.join(__dirname, 'server.js');

    // prevent node 'debug port in use' error during extension debug
    const execArgv = process.execArgv.filter(
      o =>
        o !== '--inspect' &&
        o !== '--inspect-brk' &&
        !o.startsWith('--inspect=') &&
        !o.startsWith('--inspect-brk='),
    );

    this.child = fork(server, [], {
      cwd: vscode.workspace.rootPath,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      execArgv,
    });

    this.child.stdout.on('data', data => {
      if (typeof data !== 'string') {
        data = data.toString();
      }

      this.appendLog(data);
    });

    this.child.stderr.on('data', data => {
      if (typeof data !== 'string') {
        data = data.toString();
      }

      this.appendLog(data);
    });

    this.child.on('message', data => {
      this.state = data.state;
      if (this.state === ServerState.ERROR) {
        this.log =
          this.log +
          '\r\n\r\nStorybook server didnt start.\r\nPlease fix any ' +
          'compilation errors and reopen storybook preview window';
      }

      this.eventEmmiter.fire();
    });

    this.child.send({
      rootPath: vscode.workspace.rootPath,
      port: config.port,
      staticDirs: config.staticDirs,
      configDir: config.configDir,
    });
  }

  stopServer() {
    this.appendLog('Stopping storybook server ...\n');
    if (this.child) {
      this.child.kill('SIGTERM');
      this.state = ServerState.STOPPED;
      this.child = undefined;
    }
  }

  private appendLog(data: string) {
    this.log = this.log + data;

    // remove all backspaces (\b) and any chars immedialy before
    // example: 'abc\b\bdef\bghi' => 'adeghi'
    while (this.log.indexOf('\b') !== -1) {
      this.log = this.log.replace(/[\s\S]\x08/, '');
    }

    this.throttledEvent();
  }
}
