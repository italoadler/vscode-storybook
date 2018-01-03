import * as vscode from 'vscode';
import { getStories } from './parser';
import { ServerManager, ServerState } from './serverManager';
import { StoryBookContentProvider } from './StoryBookContentProvider';

export let serverManager: ServerManager;

function openStorybook() {
  if (serverManager.serverState !== ServerState.LISTENING) {
    serverManager.prepareStart();
    process.nextTick(() => {
      serverManager.startServer();
    });
  }

  return vscode.commands
    .executeCommand(
      'vscode.previewHtml',
      StoryBookContentProvider.URI,
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

// this method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  try {
    const provider = new StoryBookContentProvider();

    serverManager = new ServerManager();

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'vscode-storybook.openStorybook',
        openStorybook,
      ),
      vscode.workspace.registerTextDocumentContentProvider(
        'storybook',
        provider,
      ),
    );

    vscode.workspace.onDidChangeTextDocument(e => {
      if (
        vscode.window.activeTextEditor &&
        e.document === vscode.window.activeTextEditor.document
      ) {
        const stories = getStories(e.document);
        if (stories.length > 0) {
          provider.update();
        }
      }
    });

    vscode.window.onDidChangeTextEditorSelection(e => {
      if (
        vscode.window.activeTextEditor &&
        e.textEditor === vscode.window.activeTextEditor
      ) {
        provider.update();
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(error);
  }
}

// this method is called when your extension is deactivated
export function deactivate() {
  serverManager.stopServer();
}
