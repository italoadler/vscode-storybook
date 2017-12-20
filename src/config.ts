import * as vscode from 'vscode';

interface Config {
  port: number;
  staticDirs: string[];
  configDir: string;
  nodePath: string;
}

const get = <T>(section: string) =>
  vscode.workspace.getConfiguration('storybook').get<T>(section);

const config: Config = {
  get port() {
    return get<number>('port');
  },
  get staticDirs() {
    return get<string[]>('staticDirs');
  },
  get configDir() {
    return get<string>('configDir');
  },
  get nodePath() {
    return get<string>('nodePath');
  },
};

export default config;
