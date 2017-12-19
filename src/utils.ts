import * as vscode from 'vscode';

export function resolveUri(document: vscode.TextDocument) {
  return vscode.Uri.parse('storybook://preview?kind=main&name=story');
}