import * as ts from 'typescript';
import * as vscode from 'vscode';

export interface Story {
  pos: number;
  end: number;
  name: string;
  kind: string;
}

const cache: { [fileName: string]: { ver: number; stories: Story[] } } = {};

export function getStories(document: vscode.TextDocument): Story[] {
  let item = cache[document.fileName];
  if (!item || item.ver !== document.version) {
    cache[document.fileName] = item = {
      ver: document.version,
      stories: parseStories(document),
    };
  }

  return item.stories;
}

function parseStories(document: vscode.TextDocument): Story[] {
  if (document.languageId === 'typescriptreact') {
    return parseStoriesTsx(document);
  }

  return [];
}

function parseStoriesTsx(document: vscode.TextDocument) {
  const sourceFile: ts.Node = ts.createSourceFile(
    document.fileName,
    document.getText(),
    ts.ScriptTarget.Latest,
    true,
  );

  // find all root constructs of code like this:
  // storiesOf("Something", module)
  //   .add("This", () => (<StorybookStory>...</StorybookStory>))
  //   .add("That", () => (<StorybookStory>...</StorybookStory>))
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

  const result: Story[] = [];

  // parse founded root constructs - parsed backwards:
  // first found: `add("That", () => (<StorybookStory>...</StorybookStory>))`
  // then its child: `add("This", () => (<StorybookStory>...</StorybookStory>))`
  // and lastly: `storiesOf("Something", module)`
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
          // found storiesOf call - fill kind to all stories founded earlier
          const kind = arg0.text;
          stories.forEach(story => {
            story.kind = kind;
          });

          result.push(...stories);
          stories = [];
        }

        if (ts.isArrowFunction(arg1)) {
          // found story
          stories.push({
            name: arg0.text,
            pos: arg1.pos,
            end: arg1.end,
          });

          // story needs to have child - either another story or storiesOf call
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

  return result;
}
