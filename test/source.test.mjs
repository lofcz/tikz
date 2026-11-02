import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanInput, describeTikzFailure, hoistFontColors, prepareTikzDocument, prepareTikzSource, definedMacroNames, repairNodeText, TikzSourceError } from '../src/source.js';
import { renderTikz } from '../src/index.js';

const squash = text => text.replace(/\s+/g, ' ').replace(/(\\begin\{tikzpicture\}) /g, '$1').replace(/ (\\end\{tikzpicture\})/g, '$1').trim();
const body = source => squash(prepareTikzSource(source).split('\\begin{document}\n')[1].replace(/\n\\end\{document\}$/, ''));
const preamble = source => squash(prepareTikzSource(source).split('\\begin{document}\n')[0]);

test('moves \\color out of font= into a trailing text= key, also in nested lists', () => {
  assert.equal(hoistFontColors(String.raw`\node[below, font=\scriptsize\color{red!70!black}] at (P) {$P$};`),
    String.raw`\node[below, font=\scriptsize, text=red!70!black] at (P) {$P$};`);
  assert.equal(hoistFontColors(String.raw`\node[font=\color{red}] at (0,0) {$P$};`), String.raw`\node[text=red] at (0,0) {$P$};`);
  assert.equal(hoistFontColors(String.raw`\node[font={\bfseries\color{blue}}, inner sep=1pt] at (0,0) {A};`),
    String.raw`\node[font={\bfseries}, inner sep=1pt, text=blue] at (0,0) {A};`);
  assert.equal(hoistFontColors(String.raw`\tikzset{every node/.style={font=\tiny\color{gray}}}`), String.raw`\tikzset{every node/.style={font=\tiny, text=gray}}`);
  assert.equal(hoistFontColors(String.raw`\node[font={\color{red}\bfseries}, label={[font=\tiny\color{gray}]above:$x$}] {A};`),
    String.raw`\node[font={\bfseries}, label={[font=\tiny, text=gray]above:$x$}, text=red] {A};`);
  for (const source of [String.raw`\node[font=\small] at (0,0) {$P$};`, String.raw`\node[text=red, font=\bfseries] {A};`, String.raw`\draw[color=blue!80!black] (0,0)--(1,0);`])
    assert.equal(hoistFontColors(source), source);
});

test('repairs node text: escapes, bare math, display math, percent after a digit', () => {
  assert.equal(repairNodeText(String.raw`{A & B #1 x_1 y^2 \frac{1}{2}ab $$x$$ \[y\] \pi r^2 \textbf{a_b} x_{12}}`),
    String.raw`{A \& B \#1 $x_1$ $y^2$ $\frac{1}{2}ab$ $\displaystyle x$ $\displaystyle y$ $\pi$ $r^2$ \textbf{$a_b$} $x_{12}$}`);
  assert.equal(cleanInput('\\node {50% sleva}; % comment\n\\node {100%};'), '\\node {50\\% sleva}; % comment\n\\node {100\\%};');
  assert.equal(repairNodeText(String.raw`{$x_1$ already math}`), String.raw`{$x_1$ already math}`);
});

test('keeps coordinate names with underscores intact', () => {
  assert.equal(body(String.raw`\begin{tikzpicture}\coordinate (C_A) at (0,0); \coordinate (C_corner) at ($(C_A)+(1,0)$);\end{tikzpicture}`),
    String.raw`\begin{tikzpicture}\coordinate (C_A) at (0,0); \coordinate (C_corner) at ($(C_A)+(1,0)$);\end{tikzpicture}`);
});

test('accepts fenced, escaped and decorated input', () => {
  const picture = String.raw`\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}`;
  assert.equal(body('```latex\n' + picture + '\n```\n\nText after.'), picture);
  assert.equal(body('Here it is:\n\n```tikz\n' + picture + '\n```'), picture);
  assert.equal(body(String.raw`\\begin{tikzpicture}\n\\draw (0,0)--(1,1);\n\\end{tikzpicture}`), picture);
  assert.equal(body(`\uFEFF${picture}`.replace(/\n/g, '\r\n')), picture);
  assert.equal(body(String.raw`\begin{figure}[h]\centering ${picture}\caption{Trojúhelník}\end{figure}`), picture);
  assert.equal(body(String.raw`\draw[-&gt;] (0,0) -- (1,0);`), String.raw`\begin{tikzpicture}\draw[->] (0,0) -- (1,0);\end{tikzpicture}`);
});

test('hoists preamble commands and converts whole documents', () => {
  const picture = String.raw`\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}`;
  const head = preamble(String.raw`\usepackage{tikz}\usepackage[czech]{babel}\usepackage{tkz-euclide}\usetikzlibrary{shapes.geometric,nonexistent}\tikzset{pt/.style={fill}}\definecolor{myblue}{RGB}{30,60,200}` + '\n' + picture);
  assert.match(head, /\\usetikzlibrary\{calc,intersections,angles,quotes,arrows\.meta,positioning,shapes\.geometric\}/);
  assert.doesNotMatch(head, /babel|nonexistent/);
  assert.match(head, /\\tikzset\{pt\/\.style=\{fill\}\} \\definecolor\{myblue\}\{RGB\}\{30,60,200\}/);
  const { notes } = prepareTikzDocument(String.raw`\usepackage{tkz-euclide}` + picture);
  assert.doesNotMatch(notes.join(' '), /tkz-euclide/);
  assert.match(head, /\\usepackage\{tkz-euclide\}/);
  const article = prepareTikzSource(String.raw`\documentclass[12pt]{article}\usepackage{tikz}\usepackage{amsmath}\begin{document}Text before. ${picture} After.\end{document}`);
  assert.match(article, /^\\documentclass\[border=6pt,varwidth\]\{standalone\}/);
  assert.match(article, /Text before\. \\begin\{tikzpicture\}/);
  assert.match(body(String.raw`\documentclass{beamer}\begin{document}\begin{frame}<1->[t]{T}{Sub}\frametitle{x}\begin{columns}[c]\begin{column}{0.5\textwidth}${picture}\end{column}\end{columns}\end{frame}\end{document}`), /^\\begin\{tikzpicture\}/);
  assert.match(prepareTikzSource(picture + String.raw`\usepackage{pgfplots}`), /\\usepackage\{pgfplots\}\n[\s\S]*\\pgfplotsset\{compat=1\.18\}/);
  assert.match(prepareTikzSource(String.raw`\begin{tikzpicture}\begin{axis}\addplot {x};\end{axis}\end{tikzpicture}`), /\\usepackage\{pgfplots\}/);
  assert.match(prepareTikzSource(String.raw`\begin{tikzpicture}\node[regular polygon, draw] {}; \draw[decorate, decoration={brace}] (0,0)--(1,0);\end{tikzpicture}`), /shapes\.geometric[\s\S]*decorations\.pathreplacing/);
});

test('preserves whitespace in qtree syntax rather than interpreting it as PGF keys', () => {
  assert.match(body(String.raw`\begin{tikzpicture}\Tree [.A B C ]\end{tikzpicture}`), /C \]/);
});

test('completes unterminated pictures and wraps loose paths', () => {
  assert.equal(body('\\begin{tikzpicture}\n\\draw (0,0)--(1,1);\n'), '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}');
  assert.equal(body(String.raw`\draw (0,0)--(1,1); \node at (1,1) {A};`), '\\begin{tikzpicture}\\draw (0,0)--(1,1); \\node at (1,1) {A};\\end{tikzpicture}');
  assert.match(body(String.raw`\begin{axis}\addplot {x};\end{axis}`), /^\\begin\{tikzpicture\}\\begin\{axis\}/);
  const two = body(String.raw`\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}\begin{tikzpicture}\draw (0,0) circle (1);\end{tikzpicture}`);
  assert.equal((two.match(/\\begin\{tikzpicture\}/g) ?? []).length, 2);
});

test('declares Unicode symbols, colours and shims the source needs', () => {
  const head = preamble(String.raw`\begin{tikzpicture}\node[fill=#ff0000, draw=slate, RoyalBlue] {x − y ≤ α, 30°, \SI{3}{\centi\metre}, \ce{H2O}, \uv{a}};\end{tikzpicture}`);
  assert.match(head, /\\DeclareUnicodeCharacter\{2212\}\{\\ensuremath\{-\}\}/);
  assert.match(head, /\\DeclareUnicodeCharacter\{03B1\}/);
  assert.match(head, /\\providecolor\{hexFF0000\}\{HTML\}\{FF0000\}/);
  assert.match(head, /\\providecolor\{slate\}\{HTML\}\{64748B\}/);
  assert.match(head, /\\providecolor\{RoyalBlue\}\{cmyk\}/);
  assert.match(head, /\\usepackage\{siunitx\}/);
  assert.match(head, /\\usepackage\{mhchem\}/);
  assert.match(body(String.raw`\begin{tikzpicture}\node {\ce{2H2 + O2 -> 2H2O}};\end{tikzpicture}`), /\\ce\{2H2 \+ O2 -> 2H2O\}/);
  assert.doesNotMatch(body(String.raw`\begin{tikzpicture}\node {\faSearch\ Najít 🔥};\end{tikzpicture}`), /faSearch|🔥/);
  assert.match(body(String.raw`\begin{tikzpicture}[remember picture, overlay, scale=2]\node {A};\end{tikzpicture}`), /\\begin\{tikzpicture\}\[scale=2\]/);
});

test('rejects what cannot become a picture with a clear message', () => {
  assert.throws(() => prepareTikzSource(''), TikzSourceError);
  assert.throws(() => prepareTikzSource('% nothing here'), /No picture found/);
  assert.throws(() => prepareTikzSource(String.raw`\begin{tikzpicture}\node {A;\end{tikzpicture}`), /Unbalanced braces/);
});

test('describes TeX failures from the log', () => {
  const log = ['! Undefined control sequence.', 'l.4 \\node at (0,0) {$x \\in \\tkzDefPoint', '', '! Missing $ inserted.', 'l.5 \\node {x_1', ''].join('\n');
  const message = describeTikzFailure({ status: 'error', pages: [], diagnostics: [], texLog: log });
  assert.match(message, /^TikZ error: Undefined command \\tkzDefPoint: check the tkz-euclide command name and arguments/);
  assert.match(message, /Math syntax/);
  assert.equal(describeTikzFailure({ status: 'ok', pages: ['a', 'b'], diagnostics: [] }), 'TikZ error: The document produced 2 pages; keep one picture.');
  assert.match(describeTikzFailure({ status: 'error', pages: [], diagnostics: [{ severity: 'error', source: 'host', message: 'dvisvgm failed (exit -5): XML error: missing closing tag(s): </g>' }] }), /colour or font switch/);
});

test('renders sources that the plain engine rejects', async () => {
  const cases = [
    String.raw`\begin{tikzpicture}\node[below, font=\scriptsize\color{red!70!black}] at (0,0) {$P$};\node[font=\bfseries\color{blue}] at (1,0) {A};\end{tikzpicture}`,
    '```latex\n\\usepackage{amsmath}\n\\begin{tikzpicture}\n\\node[fill=#ff0000!20, RoyalBlue] {Výška $v_a$ x_1 & 50% − α → ∞ \\$};\n\\end{tikzpicture}\n```',
    String.raw`\draw[-&gt;] (0,0) -- (2,0) node[right] {\SI{3}{\centi\metre} \ce{H2O}};`,
    String.raw`\documentclass{article}\usepackage{tikz}\usepackage[czech]{babel}\begin{document}\begin{figure}\centering\begin{tikzpicture}\draw (0,0) circle (1);\end{tikzpicture}\caption{Kruh}\end{figure}\end{document}`,
  ];
  for (const source of cases) {
    const image = await renderTikz(source);
    assert(image.width > 5 && image.height > 5, source);
    assert.match(image.svg, /<svg\b/);
  }

});


test('discovers definitions with the lexer, preserving comments and nested bodies', () => {
  const names = definedMacroNames(String.raw`% \def\num{fake}
\newcommand*{\ang}[1]{#1}
\foreach \qty/\unit in {1/a,2/b} {\node {\qty};}
\tikzmath{\num = {2 + 3};}
\def\distance{1}`);
  assert.deepEqual([...names].sort(), ['ang', 'distance', 'num', 'qty', 'unit']);
  assert.equal(definedMacroNames(String.raw`% \def\num{fake}`).size, 0);
  assert.match(body(String.raw`\def\ang{45}\begin{tikzpicture}\draw (0,0)--(\ang:2);\end{tikzpicture}`), /\\ang:2/);
});

test('loads extra TeX packages only when used, with real geometry and chemistry', async () => {
  const cases = [
    String.raw`\begin{tikzpicture}\tkzDefPoint(0,0){A}\tkzDefPoint(2,0){B}\tkzDefPoint(1,1){C}\tkzDrawPolygon(A,B,C)\tkzDrawPoints(A,B,C)\tkzLabelPoints(A,B,C)\end{tikzpicture}`,
    String.raw`\begin{tikzpicture}\node {\SI{3.5}{\centi\metre} \ce{2H2 + O2 -> 2H2O}};\end{tikzpicture}`,
    String.raw`\begin{tikzpicture}\pie{30/A,70/B}\end{tikzpicture}`,
    String.raw`\begin{tikzpicture}\Tree [.A B C ]\end{tikzpicture}`,
    String.raw`\begin{forest} [A [B] [C]] \end{forest}`,
    String.raw`\smartdiagram[bubble diagram]{A,B,C}`,
    String.raw`\begin{tikzpicture}\node {$\cancel{x}+\dv{x}{t}$};\end{tikzpicture}`,
  ];
  for (const source of cases) {
    const image = await renderTikz(source);
    assert(image.width > 0 && image.height > 0, source);
  }
  assert.doesNotMatch(preamble(String.raw`\draw (0,0)--(1,1);`), /usepackage\{(?:tkz-euclide|siunitx|mhchem|forest)\}/);
});
