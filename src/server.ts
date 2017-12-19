import * as vscode from 'vscode';
import * as path from 'path';
import * as storybook from '@storybook/react/server';

let server: storybook.Closeable;

export async function startServer() {
  var conf = vscode.workspace.getConfiguration('storybook');

  var staticDir = conf.get<string>('staticDir');
  if (staticDir && !path.isAbsolute(staticDir)) {
    staticDir = path.join(vscode.workspace.rootPath, staticDir);
  }

  var configDir = conf.get<string>('configDir');
  if (configDir && !path.isAbsolute(configDir)) {
    configDir = path.join(vscode.workspace.rootPath, configDir);
  }

  const config: storybook.Options = {
    port: conf.get<number>('port'),
    host: conf.get<string>('host'),
    staticDir,
    configDir,
  };

  server = await storybook.startServer(config);
}

export function stopServer() {
  server.close();
}

export function restartServer() {
  stopServer();
  startServer();
}
