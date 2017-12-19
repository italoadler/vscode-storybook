import * as vscode from 'vscode';

export class StoryBookContentProvider
  implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  public provideTextDocumentContent(uri: vscode.Uri): string {
    var port = vscode.workspace
      .getConfiguration('storybook')
      .get<number>('port');
    var hostUrl = `http://localhost:${port}/`;
    return `<iframe src='${hostUrl}' frameborder='0' style='background: white; width: 100%; height: 95vh;' />`;
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  public update(uri: vscode.Uri) {
    this._onDidChange.fire(uri);
  }
}
