import * as vscode from 'vscode';
import { Storybook } from './storybook';
import { StoryBookContentProvider } from './StoryBookContentProvider';
import { getPreviewUri } from './utils';

export let storybook: Storybook;

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "vscode-storybook" is now active!',
  );

  const provider = new StoryBookContentProvider();
  storybook = new Storybook();

  vscode.workspace.onDidChangeTextDocument(
    (e: vscode.TextDocumentChangeEvent) => {
      if (e.document === vscode.window.activeTextEditor.document) {
        const uri = getPreviewUri(vscode.window.activeTextEditor);
        provider.update(uri);
      }
    },
  );

  vscode.window.onDidChangeTextEditorSelection(
    (e: vscode.TextEditorSelectionChangeEvent) => {
      if (e.textEditor === vscode.window.activeTextEditor) {
        const uri = getPreviewUri(vscode.window.activeTextEditor);
        provider.update(uri);
      }
    },
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'vscode-storybook.openStorybook',
      openStorybook,
    ),
    vscode.workspace.registerTextDocumentContentProvider('storybook', provider),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  if (storybook) {
    storybook.stopServer();
  }
}

function openStorybook() {
  return vscode.commands
    .executeCommand(
      'vscode.previewHtml',
      StoryBookContentProvider.uri,
      vscode.ViewColumn.Two,
      'Storybook preview',
    )
    .then(
      success => {
        // no-op
      },
      error => {
        vscode.window.showErrorMessage(error);
      },
    );
}
