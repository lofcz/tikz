export const fixtures = {
  simple: String.raw`\documentclass[tikz]{standalone}\begin{document}\begin{tikzpicture}\draw (0,0)--(2,1);\node at (1,1) {$\frac{1}{2}$};\end{tikzpicture}\end{document}`,
  plot: String.raw`\documentclass[tikz]{standalone}\usepackage{pgfplots}\pgfplotsset{compat=1.18}\begin{document}\begin{tikzpicture}\begin{axis}[width=8cm,height=6cm]\addplot[domain=-4:4,samples=200] {sin(deg(x))*x^2};\end{axis}\end{tikzpicture}\end{document}`,
  graph: String.raw`\documentclass[tikz]{standalone}\usetikzlibrary{graphs,graphdrawing}\usegdlibrary{trees}\begin{document}\begin{tikzpicture}\graph[tree layout] {a -> {b -> {d,e}, c -> {f,g}}};\end{tikzpicture}\end{document}`,
  large: String.raw`\documentclass[tikz]{standalone}\begin{document}\begin{tikzpicture}\foreach \x in {0,...,35} {\foreach \y in {0,...,20} {\draw[blue] (\x/5,\y/5) circle (0.06);\node[scale=0.2] at (\x/5,\y/5) {$x^2$};}}\end{tikzpicture}\end{document}`,
};
