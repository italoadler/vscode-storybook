import { ChildProcess, fork } from 'child_process';
import * as path from 'path';
import { throttle } from 'throttle-debounce';
import * as vscode from 'vscode';
import config from './config';

export enum ServerState {
  STOPPED = 'STOPED',
  STARTING = 'STARTING',
  LISTENING = 'LISTENING',
}

export class Storybook {
  private state: ServerState;
  private child: ChildProcess;
  private eventEmmiter: vscode.EventEmitter<void>;
  private log: string;
  private throttledEvent: () => void;

  constructor() {
    this.state = ServerState.STOPPED;
    this.eventEmmiter = new vscode.EventEmitter<void>();
    this.log = '';

    this.throttledEvent = throttle(100, () => {
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
    this.log = 'Starting storybook server ...\r\n';
    this.state = ServerState.STARTING;
  }

  startServer() {
    const server = path.join(__dirname, 'server.js');
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
    if (this.child) {
      this.child.send('SIGTERM');
      this.child = undefined;
    }
  }

  private appendLog(data: string) {
    this.log = this.log + data;

    // remove all backspaces and any chars immedialy before
    while (this.log.indexOf('\b') !== -1) {
      this.log = this.log.replace(/.\x08/, '');
    }

    this.throttledEvent();
  }
}
