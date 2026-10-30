import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';

const excludedDirectories = new Set([
  'node_modules',
  'dist',
  'local-dist',
  'build',
  'coverage',
  'assets',
  'artifacts',
  'test-results',
  'playwright-report',
]);

function isEnvironment(node) {
  return (
    (ts.isIdentifier(node) && node.text === 'env') ||
    (ts.isPropertyAccessExpression(node) &&
      node.name.text === 'env' &&
      ((ts.isIdentifier(node.expression) && node.expression.text === 'process') ||
        (ts.isMetaProperty(node.expression) && node.expression.name.text === 'meta')))
  );
}

export function sourceEnvironmentKeys(source, filename = 'source.ts') {
  const keys = new Set();
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const add = (name) => {
    if (/^[A-Z][A-Z0-9_]*$/u.test(name)) keys.add(name);
  };
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && isEnvironment(node.expression)) {
      add(node.name.text);
    } else if (
      ts.isElementAccessExpression(node) &&
      isEnvironment(node.expression) &&
      node.argumentExpression &&
      ts.isStringLiteral(node.argumentExpression)
    ) {
      add(node.argumentExpression.text);
    } else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      isEnvironment(node.initializer) &&
      ts.isObjectBindingPattern(node.name)
    ) {
      for (const element of node.name.elements) {
        const name = element.propertyName ?? element.name;
        if (ts.isIdentifier(name) || ts.isStringLiteral(name)) add(name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return keys;
}

export function environmentTemplateKeys(source) {
  return new Set([...source.matchAll(/^([A-Z][A-Z0-9_]*)=/gmu)].map((match) => match[1]));
}

export async function auditEnvironmentTemplates(root = new URL('../../', import.meta.url)) {
  const keys = new Map();
  async function scan(folder) {
    for (const entry of await readdir(new URL(folder, root), { withFileTypes: true })) {
      const path = `${folder}${entry.name}`;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !excludedDirectories.has(entry.name)) {
          await scan(`${path}/`);
        }
      } else if (entry.isFile() && /\.(?:mjs|js|ts|tsx|mts)$/u.test(entry.name)) {
        for (const key of sourceEnvironmentKeys(
          await readFile(new URL(path, root), 'utf8'),
          path,
        )) {
          if (!keys.has(key)) keys.set(key, path);
        }
      }
    }
  }
  for (const folder of ['src/', 'apps/', 'scripts/']) await scan(folder);
  const missing = [];
  for (const template of ['.env.example', 'apps/aethergrid-console/.env.example']) {
    const documented = environmentTemplateKeys(await readFile(new URL(template, root), 'utf8'));
    for (const [key, source] of keys) {
      if (!documented.has(key)) missing.push({ template, key, source });
    }
  }
  return { keys, missing };
}
