import * as vscode from 'vscode';
import { StoryBookContentProvider } from './StoryBookContentProvider';
import { resolveUri } from './utils';
import { stopServer, startServer } from './server';

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "vscode-storybook" is now active!',
  );

  startServer();

  let provider = new StoryBookContentProvider();

  vscode.workspace.onDidChangeTextDocument(
    (e: vscode.TextDocumentChangeEvent) => {
      if (e.document === vscode.window.activeTextEditor.document) {
        const uri = resolveUri(vscode.window.activeTextEditor.document);
        provider.update(uri);
      }
    },
  );

  vscode.window.onDidChangeTextEditorSelection(
    (e: vscode.TextEditorSelectionChangeEvent) => {
      if (e.textEditor === vscode.window.activeTextEditor) {
        const uri = resolveUri(vscode.window.activeTextEditor.document);
        provider.update(uri);
      }
    },
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-storybook.openStorybook', openStorybook),
    vscode.workspace.registerTextDocumentContentProvider('storybook', provider),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  stopServer();
}

function openStorybook() {
  return vscode.commands
    .executeCommand(
      'vscode.previewHtml',
      vscode.Uri.parse('storybook://preview'),
      vscode.ViewColumn.Two,
      'Story book',
    )
    .then(
      success => {},
      reason => {
        vscode.window.showErrorMessage(reason);
      },
    );
}
