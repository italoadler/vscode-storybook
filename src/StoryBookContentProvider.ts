import * as querystring from 'querystring';
import * as vscode from 'vscode';
import config from './config';
import { storybook } from './extension';
import { getStories, Story } from './parser';
import { ServerState } from './storybook';

export class StoryBookContentProvider
  implements vscode.TextDocumentContentProvider {
  static readonly uri = vscode.Uri.parse('storybook://preview');

  private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  private storybookLogListener: vscode.Disposable;
  private story: Story;

  provideTextDocumentContent(uri: vscode.Uri): string {
    if (storybook.serverState !== ServerState.LISTENING) {
      return this.serverStart(uri);
    }

    return this.showStory();
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this.onDidChangeEmitter.event;
  }

  update(uri: vscode.Uri) {
    const editor = vscode.window.activeTextEditor;
    const stories = getStories(editor.document);
    const pos = editor.document.offsetAt(editor.selection.active);
    this.story = stories.filter(o => o.pos < pos && o.end > pos)[0];
    this.onDidChangeEmitter.fire(uri);
  }

  private serverStart(uri: vscode.Uri) {
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
    } else {
      if (this.storybookLogListener) {
        this.storybookLogListener.dispose();
        this.storybookLogListener = undefined;
        this.update(uri);
      }
    }

    const style = 'width: 100%; padding-left: 2em; text-indent: -2em;';
    return `<pre style="${style}">${storybook.logLines}</pre>`;
  }

  private showStory() {
    if (!this.story) {
      return '<div>No story is selected.</div>';
    }

    const { kind, name: story } = this.story;

    const hostUrl =
      `http://localhost:${config.port}/` +
      `?selectedKind=${kind}&selectedStory=${story}&full=1`;

    const style = 'background: white; width: 100%; height: 95vh;';
    return `<iframe src='${hostUrl}' frameborder='0' style='${style}' />`;
  }
}
