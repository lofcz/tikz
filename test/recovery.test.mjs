import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recoverGeneratedSyntax } from '../src/recover.js';
import { prepareTikzSource } from '../src/source.js';
import { renderTikz } from '../src/index.js';

const picture = body => String.raw`\begin{tikzpicture}${body}\end{tikzpicture}`;

test('extended variable bindings are lexical, including calc math and let aliases', () => {
  const result = recoverGeneratedSyntax(String.raw`% \def\alpha_deg{99}
\def\alpha_deg{35}\let\beta_deg\alpha_deg
\pgfmathsetmacro{\radius2}{2}
\draw (0,0)--($(0,0)+(\alpha_deg:\radius2)$);
\node {$\alpha$};\def\take#1_end{#1}`);
  assert(result.includes(String.raw`% \def\alpha_deg{99}`));
  assert.match(result, /\\let\\tikzRecoveredVariableB\\tikzRecoveredVariableA/);
  assert.match(result, /\(\\tikzRecoveredVariableA:\\tikzRecoveredVariableC\)/);
  assert(result.includes(String.raw`\node {$\alpha$}`));
  assert(result.includes(String.raw`\def\take#1_end{#1}`));
});

test('coordinate repairs leave node text, coordinate names and real macro parameters alone', () => {
  const source = picture(String.raw`\coordinate (point_2) at (1,2);\node at (point_2) {cos(30), {x}cm};\def\point#1{#1}`);
  assert.equal(recoverGeneratedSyntax(source), source);
  assert.equal(recoverGeneratedSyntax(picture(String.raw`\draw ({cos(30)},{sin(30)})--(1,2);`)), picture(String.raw`\draw ({cos(30)},{sin(30)})--(1,2);`));
  assert.equal(recoverGeneratedSyntax(String.raw`\pgfmathparse{2 + 3 mod 5}`), String.raw`\pgfmathparse{2 + 3 mod 5}`);
});

test('PGFPlots style setters and font declarations keep their native meaning', () => {
  const result = prepareTikzSource(picture(String.raw`\begin{axis}[tick style={red},axis line style={blue}]\addplot {x};\end{axis}\node[font=\boldmath] {$x$};`));
  assert.match(result, /tick style=\{red\}/);
  assert.doesNotMatch(result, /tick style\/\.style/);
  assert.match(result, /font=\\boldmath/);
});

// Compare complete rendered geometry with independently written standard TikZ.
// Two parameter sets ensure the repairs evaluate the supplied expressions.
test('repaired variables and coordinate dimensions render exactly the canonical geometry', async () => {
  for (const [angle, radius] of [[25, 2], [65, 3.5]]) {
    const generated = picture(String.raw`\def\angle_deg{${angle}}\pgfmathsetmacro{\radius2}{${radius}}\draw (cos(30),sin(30))--(\angle_deg:{.8*\radius2}cm);\draw (0,0)--($(0,0)+(\angle_deg:{.5*\radius2}cm)$);`);
    const canonical = picture(String.raw`\draw ({cos(30)},{sin(30)})--(${angle}:{.8*${radius}*1cm});\draw (0,0)--($(0,0)+(${angle}:{.5*${radius}*1cm})$);`);
    const actual = await renderTikz(generated), expected = await renderTikz(canonical);
    assert.equal(actual.svg, expected.svg);
  }
});

test('arrow brackets and omitted style declarations preserve explicit appearance', async () => {
  const actual = await renderTikz(String.raw`\begin{tikzpicture}[>=Latex[length=3mm,width=2mm],line style={thick,blue}]\draw[->,line style] (0,0)--(2,1);\end{tikzpicture}`);
  const expected = await renderTikz(String.raw`\begin{tikzpicture}[>={Latex[length=3mm,width=2mm]},line style/.style={thick,blue}]\draw[->,line style] (0,0)--(2,1);\end{tikzpicture}`);
  assert.equal(actual.svg, expected.svg);
});

test('tkz midpoint outputs, projection shorthand and circle modes preserve geometry', async () => {
  const prefix = String.raw`\tkzDefPoint(0,0){A}\tkzDefPoint(4,0){B}\tkzDefPoint(1,3){C}`;
  const generated = picture(prefix + String.raw`\tkzMidPoint(A,B){M}\tkzDefPointBy[projection=onto line A--B](C){H}\tkzDrawSegment(M,H)\tkzDrawCircle[circum,blue](A,B,C)`);
  const canonical = picture(prefix + String.raw`\tkzDefMidPoint(A,B)\tkzGetPoint{M}\tkzDefPointBy[projection=onto A--B](C)\tkzGetPoint{H}\tkzDrawSegment(M,H){\tkzDefCircle[circum](A,B,C)\tkzGetPoints{O}{P}\tkzDrawCircle[blue](O,P)}`);
  assert.equal((await renderTikz(generated)).svg, (await renderTikz(canonical)).svg);
});

test('arithmetic number labels evaluate the expression instead of dropping operators', async () => {
  const generated = picture(String.raw`\def\side{4}\pgfmathtruncatemacro{\remainder}{\side mod 3}\node {$\pgfmathprintnumber{\side*\side}$, \remainder};`);
  const canonical = picture(String.raw`\node {$\pgfmathprintnumber{16}$, 1};`);
  assert.equal((await renderTikz(generated)).svg, (await renderTikz(canonical)).svg);
});

test('quoted bold math and styles named after native node properties remain usable', async () => {
  const source = String.raw`\tikzset{name/.style={font=\small},label/.style={blue}}\begin{tikzpicture}\coordinate (A) at (0,0);\coordinate (B) at (2,0);\coordinate (C) at (0,2);\node[name,label,label=above:{X}] at (A) {A};\pic[draw,"{\boldmath$\alpha$}"] {angle=B--A--C};\end{tikzpicture}`;
  const result = await renderTikz(source);
  assert(result.width > 20 && result.height > 20);
});

test('relative node positions and positioning math compile without changing offsets', async () => {
  const generated = picture(String.raw`\coordinate (P) at (1,2);\node at (P) ++(30:2) {A};\node[above=3mm of $(1,2)$] {B};`);
  const canonical = picture(String.raw`\coordinate (P) at (1,2);\node at ($(P)+(30:2)$) {A};\node[above={3mm of $(1,2)$}] {B};`);
  assert.equal((await renderTikz(generated)).svg, (await renderTikz(canonical)).svg);
});

test('distance calculations and circle radii use the given geometry', async () => {
  const source = picture(String.raw`\coordinate (A) at (0,0);\coordinate (B) at (3,4);\pgfmathdistance{\pgfpointanchor{A}{center}}{\pgfpointanchor{B}{center}}\let\distanceValue\pgfmathresult\draw (0,0) circle (\distanceValue pt);`);
  const result = await renderTikz(source), canonical = await renderTikz(picture(String.raw`\draw (0,0) circle (5cm);`));
  assert(Math.abs(result.width - canonical.width) < 0.02);
  assert(Math.abs(result.height - canonical.height) < 0.02);
  assert.doesNotMatch(prepareTikzSource(String.raw`\newcommand{\pgfmathdistance}[2]{1}\begin{tikzpicture}\node {\pgfmathdistance{a}{b}};\end{tikzpicture}`), /providecommand\{\\pgfmathdistance\}/);
});

test('coordinate positioning protects commas and custom style definitions win over aliases', async () => {
  assert.equal((await renderTikz(picture(String.raw`\node[above=3mm of 1,2] {A};`))).svg,
    (await renderTikz(picture(String.raw`\node[above={3mm of 1,2}] {A};`))).svg);
  assert.equal((await renderTikz(String.raw`\tikzset{rounded cap/.style={line cap=rect},final/.style={red}}\begin{tikzpicture}\draw[rounded cap,final] (0,0)--(2,1);\end{tikzpicture}`)).svg,
    (await renderTikz(picture(String.raw`\draw[line cap=rect,red] (0,0)--(2,1);`))).svg);
});
