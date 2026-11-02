import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hoistFontColors, prepareTikzSource, wrapStandalone } from '../src/source.js';
import { renderTikz } from '../src/index.js';

test('moves \\color out of font= into a trailing text= key', () => {
  assert.equal(hoistFontColors(String.raw`\node[below, font=\scriptsize\color{red!70!black}] at (P) {$P$};`),
    String.raw`\node[below, font=\scriptsize, text=red!70!black] at (P) {$P$};`);
  assert.equal(hoistFontColors(String.raw`\node[font=\color{red}] at (0,0) {$P$};`), String.raw`\node[text=red] at (0,0) {$P$};`);
  assert.equal(hoistFontColors(String.raw`\node[font={\bfseries\color{blue}}, inner sep=1pt] at (0,0) {A};`),
    String.raw`\node[font={\bfseries}, inner sep=1pt, text=blue] at (0,0) {A};`);
  assert.equal(hoistFontColors(String.raw`\node[fill=white, font=\small\color{teal}, draw] {x};`), String.raw`\node[fill=white, font=\small, draw, text=teal] {x};`);
  assert.equal(hoistFontColors(String.raw`\tikzset{every node/.style={font=\tiny\color{gray}}}`), String.raw`\tikzset{every node/.style={font=\tiny, text=gray}}`);
  assert.equal(hoistFontColors(String.raw`\node[label={[font=\tiny\color{gray}]above:$x$}] {};`), String.raw`\node[label={[font=\tiny, text=gray]above:$x$}] {};`);
});

test('leaves ordinary sources untouched', () => {
  for (const source of [
    String.raw`\node[font=\small] at (0,0) {$P$};`,
    String.raw`\node at (0,0) {\color{red} $P$};`,
    String.raw`\node[text=red, font=\bfseries] {A};`,
    String.raw`\draw[color=blue!80!black] (0,0)--(1,0);`,
    String.raw`\begin{tikzpicture}[font=\small]\draw (0,0)--(1,0) node[midway, right] {$v$};\end{tikzpicture}`,
  ]) assert.equal(hoistFontColors(source), source);
});

test('wraps bare pictures once and keeps complete documents', () => {
  const bare = String.raw`\begin{tikzpicture}\draw (0,0)--(1,0);\end{tikzpicture}`;
  const wrapped = prepareTikzSource(bare);
  assert.match(wrapped, /^\\documentclass\[tikz,border=6pt\]\{standalone\}/);
  assert.equal(prepareTikzSource(wrapped), wrapped);
  assert.equal(wrapStandalone(String.raw`\documentclass{article}x`), String.raw`\documentclass{article}x`);
});

test('renders a font colour switch that dvisvgm otherwise rejects', async () => {
  const image = await renderTikz(String.raw`\begin{tikzpicture}
\node[below, font=\scriptsize\color{red!70!black}] at (0,0) {$P$};
\node[font=\bfseries\color{blue}] at (1,0) {A};
\end{tikzpicture}`);
  assert(image.width > 10 && image.height > 5);
  assert.match(image.svg, /<svg\b/);
});
