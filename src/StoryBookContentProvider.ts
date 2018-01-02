import * as querystring from 'querystring';
import * as vscode from 'vscode';
import config from './config';
import { serverManager } from './extension';
import { getStories, Story } from './parser';
import { ServerState } from './serverManager';

export class StoryBookContentProvider
  implements vscode.TextDocumentContentProvider {
  static readonly URI = vscode.Uri.parse('storybook://preview');

  private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  private storybookLogListener: vscode.Disposable;
  private story: Story;

  provideTextDocumentContent(): string {
    if (serverManager.serverState !== ServerState.LISTENING) {
      if (!this.storybookLogListener) {
        this.storybookLogListener = serverManager.onLog(() => {
          this.update();
        });
      }

      if (serverManager.serverState === ServerState.STOPPED) {
        serverManager.prepareStart();
        process.nextTick(() => {
          serverManager.startServer();
        });
      }

      const style = 'width: 100%; padding-left: 2em; text-indent: -2em;';
      return `<pre style="${style}">${serverManager.logLines}</pre>`;
    }

    if (this.storybookLogListener) {
      this.storybookLogListener.dispose();
      this.storybookLogListener = undefined;
    }

    return this.showStory();
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this.onDidChangeEmitter.event;
  }

  update() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const stories = getStories(editor.document);
      const pos = editor.document.offsetAt(editor.selection.active);
      this.story = stories.filter(o => o.pos < pos && o.end > pos)[0];
    } else {
      this.story = undefined;
    }

    this.onDidChangeEmitter.fire(StoryBookContentProvider.URI);
  }

  private showStory() {
    if (!this.story) {
      return (
        '<div>No story is selected.<br />Select story by setting cursor ' +
        'anywhere inside arrow function, witch is rendering story.</div>'
      );
    }

    const { kind, name: story } = this.story;

    const hostUrl =
      `http://localhost:${config.port}/` +
      `?selectedKind=${kind}&selectedStory=${story}&full=1`;

    const style = 'background: white; width: 100%; height: 95vh;';
    return (
      `<div>Kind: <b>${kind}</b>, Story: <b>${story}</b></div><hr />` +
      `<iframe src='${hostUrl}' frameborder='0' style='${style}' />`
    );
  }
}
