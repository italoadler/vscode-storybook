import * as vscode from 'vscode';
import { Storybook } from './storybook';
import { StoryBookContentProvider } from './StoryBookContentProvider';
import { getStories } from './parser';

export let storybook: Storybook;
export let channel: vscode.OutputChannel;

function openStorybook() {
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

export function activate(context: vscode.ExtensionContext) {
  try {
    const provider = new StoryBookContentProvider();

    storybook = new Storybook();
    channel = vscode.window.createOutputChannel('Storybook');

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

    vscode.workspace.onDidCloseTextDocument(e => {
      if (e.uri.scheme === 'storybook') {
        storybook.stopServer();
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(error);
  }
}

// this method is called when your extension is deactivated
export function deactivate() {
  storybook.stopServer();
}
