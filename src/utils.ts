import * as path from 'path';
import * as ts from 'typescript';
import { isCallExpression } from 'typescript';
import { deprecate } from 'util';
import * as vscode from 'vscode';

export function getPreviewUri(editor: vscode.TextEditor) {
  const stories = resolveStories(editor.document);
  const pos = editor.document.offsetAt(editor.selection.active);
  const story = stories.filter(o => o.pos < pos && o.end > pos)[0];
  return vscode.Uri.parse(
    `storybook://preview?kind=${story.kind}&story=${story.name}`,
  );
}

interface Story {
  pos: number;
  end: number;
  name: string;
  kind: string;
}
const positions: { [fileName: string]: { ver: number; stories: Story[] } } = {};

function resolveStories(document: vscode.TextDocument): Story[] {
  const cached = positions[document.fileName];
  if (cached && cached.ver === document.version) {
    return cached.stories;
  }

  const sourceFile: ts.Node = ts.createSourceFile(
    document.fileName,
    document.getText(),
    ts.ScriptTarget.Latest,
    true,
  );

  const calls: ts.CallExpression[] = [];
  const nodes: ts.Node[] = [sourceFile];
  while (nodes.length > 0) {
    const n = nodes.shift();
    if (ts.isCallExpression(n) && n.arguments.length === 2) {
      calls.push(n);
    } else {
      nodes.push(...n.getChildren());
    }
  }

  const result = {
    ver: document.version,
    stories: [],
  };

  calls.forEach(n => {
    let stories = [];
    let node = n;
    while (node) {
      const tmp = node;
      node = undefined;

      const arg0 = tmp.arguments[0];
      const arg1 = tmp.arguments[1];
      if (ts.isStringLiteral(arg0)) {
        if (ts.isIdentifier(arg1)) {
          const kind = arg0.text;
          stories.forEach(story => {
            story.kind = kind;
          });

          result.stories.push(...stories);
          stories = [];
        }

        if (ts.isArrowFunction(arg1)) {
          stories.push({
            name: arg0.text,
            pos: arg1.pos,
            end: arg1.end,
          });

          const firstChild = tmp.getChildAt(0);
          if (ts.isPropertyAccessExpression(firstChild)) {
            const firstChildExpression = firstChild.expression;
            if (ts.isCallExpression(firstChildExpression)) {
              node = firstChildExpression;
            }
          }
        }
      }
    }
  });

  positions[document.fileName] = result;
  return result.stories;
}

export function throttle(fn: any, threshhold: number, scope?: any) {
  threshhold = threshhold || (threshhold = 250);
  let last;
  let deferTimer;
  return function(...args: any[]) {
    const context = scope || this;
    const now = +new Date();
    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer);
      deferTimer = setTimeout(() => {
        last = now;
        fn.apply(context, args);
      }, threshhold);
    } else {
      last = now;
      fn.apply(context, args);
    }
  };
}
