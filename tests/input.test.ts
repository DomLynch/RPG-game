import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('attack stays a DOM hit target during cooldown so repeated touches are consumed', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const button = html.match(/<button\b[^>]*id="attack-button"[^>]*>/)![0];
  assert.doesNotMatch(button, /\sdisabled(?:\s|=|>)/);
  const source = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node) {
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(source) === 'attackButton') assert.notEqual(node.name.text, 'disabled', 'Use aria-disabled with the input guard; native disabled drops touch handling');
    ts.forEachChild(node, visit);
  }
  visit(source);
});

test('page declares double-tap suppression without restricting pinch zoom', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css.match(/:root\{([^}]+)\}/)![1], /(?:^|;)touch-action:manipulation(?:;|$)/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[,"\s])/);
});
