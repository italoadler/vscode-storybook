import * as querystring from 'querystring';
import * as vscode from 'vscode';
import { storybook } from './extension';
import { ServerState } from './storybook';
import { getPreviewUri } from './utils';

export class StoryBookContentProvider
  implements vscode.TextDocumentContentProvider {
  static readonly uri = vscode.Uri.parse('storybook://preview');

  private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  private query: any;
  private storybookLogListener: vscode.Disposable;

  provideTextDocumentContent(uri: vscode.Uri): string {
    const serverState = this.serverStartLog(uri);
    if (serverState) {
      return serverState;
    }

    const port = vscode.workspace
      .getConfiguration('storybook')
      .get<number>('port');

    const hostUrl = [
      'http://localhost:',
      port,
      '/?selectedKind=',
      this.query.kind,
      '&selectedStory=',
      this.query.story,
      '&full=1',
    ].join('');
    const style = 'background: white; width: 100%; height: 95vh;';
    return `<iframe src='${hostUrl}' frameborder='0' style='${style}' />`;
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this.onDidChangeEmitter.event;
  }

  update(uri: vscode.Uri) {
    this.query = querystring.parse(uri.query);
    this.onDidChangeEmitter.fire(StoryBookContentProvider.uri);
  }

  private serverStartLog(uri: vscode.Uri) {
    if (storybook.serverState !== ServerState.LISTENING) {
      if (!this.storybookLogListener) {
        this.storybookLogListener = storybook.onLog(() => {
          this.update(uri);
        });
      }

      if (storybook.serverState === ServerState.STOPPED) {
        storybook.prepareStart();
        process.nextTick(() => {
          storybook.startServer();
        });
      }

      return `<pre>${storybook.logLines}</pre>`;
    } else {
      if (this.storybookLogListener) {
        this.storybookLogListener.dispose();
        this.storybookLogListener = undefined;
        const previewUri = getPreviewUri(vscode.window.activeTextEditor);
        this.update(previewUri);
        return `<pre>${storybook.logLines}</pre>`;
      }
    }

    return undefined;
  }
}
