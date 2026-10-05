This section describes how the values on this page are computed. The code is public and the data can be downloaded, so every number can be rebuilt.

### Rate and expected positions

For unit *i* (a university or a region), with <math><msub><mi>O</mi><mi>i</mi></msub></math> observed positions and denominator <math><msub><mi>D</mi><mi>i</mi></msub></math> (teaching and research staff, enrolled students or residents), the rate is

<math display="block"><msub><mi>r</mi><mi>i</mi></msub><mo>=</mo><mi>k</mi><mo>·</mo><mfrac><msub><mi>O</mi><mi>i</mi></msub><msub><mi>D</mi><mi>i</mi></msub></mfrac><mo>,</mo><mspace width="1em"/><mi>k</mi><mo>∈</mo><mo>{</mo><msup><mn>10</mn><mn>2</mn></msup><mo>,</mo><msup><mn>10</mn><mn>3</mn></msup><mo>,</mo><msup><mn>10</mn><mn>5</mn></msup><mo>}</mo></math>

A region sums the numerators and denominators of its universities; online universities, with students across the country, belong to no region. The reference is the national rate, computed over the same units, which gives the expected positions:

<math display="block"><msub><mi>E</mi><mi>i</mi></msub><mo>=</mo><msub><mi>D</mi><mi>i</mi></msub><mo>·</mo><mfrac><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>O</mi><mi>j</mi></msub></mrow><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>D</mi><mi>j</mi></msub></mrow></mfrac></math>

### Map colours

The map shows the ratio <math><msub><mi>O</mi><mi>i</mi></msub><mo lspace="0" rspace="0">/</mo><msub><mi>E</mi><mi>i</mi></msub></math> in five classes, symmetric on a logarithmic scale: up to 0.5; from 0.5 to 0.8; between 0.8 and 1.25; from 1.25 to 2; 2 and above. For precarity the class depends on the difference between the unit's share and the national one: within 5 percentage points, between 5 and 15, beyond 15. Colours describe the size of the difference, not its significance.

### 95% intervals

The interval of <math><msub><mi>O</mi><mi>i</mi></msub></math> uses Byar's approximation to the exact Poisson interval [[1]](#ref-1), with <math><mi>z</mi><mo>=</mo><mn>1.96</mn></math>:

<math display="block"><msub><mi>O</mi><mi>L</mi></msub><mo>=</mo><mi>O</mi><msup><mrow><mo>(</mo><mn>1</mn><mo>−</mo><mn>1</mn><mo lspace="0" rspace="0">/</mo><mrow><mo>(</mo><mn>9</mn><mi>O</mi><mo>)</mo></mrow><mo>−</mo><mi>z</mi><mo lspace="0" rspace="0">/</mo><mrow><mo>(</mo><mn>3</mn><msqrt><mi>O</mi></msqrt><mo>)</mo></mrow><mo>)</mo></mrow><mn>3</mn></msup><mo>,</mo><mspace width="1em"/><msub><mi>O</mi><mi>U</mi></msub><mo>=</mo><mrow><mo>(</mo><mi>O</mi><mo>+</mo><mn>1</mn><mo>)</mo></mrow><msup><mrow><mo>(</mo><mn>1</mn><mo>−</mo><mn>1</mn><mo lspace="0" rspace="0">/</mo><mrow><mo>(</mo><mn>9</mn><mo>(</mo><mi>O</mi><mo>+</mo><mn>1</mn><mo>)</mo><mo>)</mo></mrow><mo>+</mo><mi>z</mi><mo lspace="0" rspace="0">/</mo><mrow><mo>(</mo><mn>3</mn><msqrt><mi>O</mi><mo>+</mo><mn>1</mn></msqrt><mo>)</mo></mrow><mo>)</mo></mrow><mn>3</mn></msup></math>

For the precarious share, with <math><msub><mi>P</mi><mi>i</mi></msub></math> precarious positions out of <math><msub><mi>N</mi><mi>i</mi></msub></math> precarious and permanent ones, the interval is Wilson's [[2]](#ref-2).

Positions are not independent events, since one call can open many at once, and the observed variance exceeds the theoretical one. Following [[3]](#ref-3), the width of each interval around the observed value is multiplied by <math><msqrt><mover accent="true"><mi>φ</mi><mo>^</mo></mover></msqrt></math>, where <math><mover accent="true"><mi>φ</mi><mo>^</mo></mover></math> is an overdispersion factor estimated from the standardised deviations from the national reference (<math><mi>p</mi></math> is the national precarious share):

<math display="block"><msub><mi>z</mi><mi>i</mi></msub><mo>=</mo><mfrac><mrow><msub><mi>O</mi><mi>i</mi></msub><mo>−</mo><msub><mi>E</mi><mi>i</mi></msub></mrow><msqrt><msub><mi>E</mi><mi>i</mi></msub></msqrt></mfrac><mo>,</mo><mspace width="2em"/><msub><mi>z</mi><mi>i</mi></msub><mo>=</mo><mfrac><mrow><msub><mi>P</mi><mi>i</mi></msub><mo>−</mo><msub><mi>N</mi><mi>i</mi></msub><mi>p</mi></mrow><msqrt><mrow><msub><mi>N</mi><mi>i</mi></msub><mi>p</mi><mrow><mo>(</mo><mn>1</mn><mo>−</mo><mi>p</mi><mo>)</mo></mrow></mrow></msqrt></mfrac></math>

<math display="block"><mover accent="true"><mi>φ</mi><mo>^</mo></mover><mo>=</mo><mi>max</mi><mrow><mo>(</mo><mn>1</mn><mo>,</mo><mfrac><mn>1</mn><mi>n</mi></mfrac><munder><mo>∑</mo><mi>i</mi></munder><msubsup><mover accent="true"><mi>z</mi><mo>~</mo></mover><mi>i</mi><mn>2</mn></msubsup><mo>)</mo></mrow></math>

with <math><msub><mover accent="true"><mi>z</mi><mo>~</mo></mover><mi>i</mi></msub></math> the deviations winsorised at 10% per tail. Only units with <math><msub><mi>E</mi><mi>i</mi></msub><mo>≥</mo><mn>5</mn></math> enter the estimate (for the share, <math><msub><mi>N</mi><mi>i</mi></msub><mi>p</mi><mo>≥</mo><mn>5</mn></math> and <math><msub><mi>N</mi><mi>i</mi></msub><mrow><mo>(</mo><mn>1</mn><mo>−</mo><mi>p</mi><mo>)</mo></mrow><mo>≥</mo><mn>5</mn></math>); if there are fewer than ten, <math><mover accent="true"><mi>φ</mi><mo>^</mo></mover><mo>=</mo><mn>1</mn></math>.

### Sources

- **Calls:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), collected every day by PostTheDoc and also published as an open dataset.
- **Teaching and research staff and enrolled students** per university: [USTAT](https://ustat.mur.gov.it), MUR's statistics portal (IODL 2.0 licence). We count full and associate professors and researchers, permanent and fixed-term. The special schools, such as the Scuola Normale or SISSA, have no enrolled students in USTAT and are left out of the per-student comparison only.
- **Residents** per region: ISTAT, through Eurostat (CC BY 4.0 licence).
- **Map:** ISTAT regional boundaries from openpolis/geojson-italy (CC BY 4.0) and city locations from OpenStreetMap (ODbL).

### What these data do not say

The observatory shows where more positions are advertised and where fewer, but not why. A high rate can come from retirements, extraordinary hiring plans, PNRR projects or the university's own choices; a low one, from strained budgets or frozen turnover. These are differences to look into, not to take for granted: asking a university why it advertises so little, or a region why it lags behind, is exactly what these data are public for. It is a starting point for questions, not a conclusion.

The same goes for the application window. The date of a call is that of its act, while publication on the portal may come a few days later: the real window to apply may therefore be shorter than the one shown.

### References

<ol class="obs-refs">
<li id="ref-1">Breslow, N. E., and Day, N. E. (1987). <em>Statistical Methods in Cancer Research. Volume II: The Design and Analysis of Cohort Studies</em> (IARC Scientific Publications, no. 82). Lyon: International Agency for Research on Cancer. Gives Byar's approximation to the exact Poisson interval.</li>
<li id="ref-2">Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. <em>Journal of the American Statistical Association</em>, 22(158), 209–212. <a href="https://doi.org/10.1080/01621459.1927.10502953">doi:10.1080/01621459.1927.10502953</a></li>
<li id="ref-3">Spiegelhalter, D. J. (2005). Funnel plots for comparing institutional performance. <em>Statistics in Medicine</em>, 24(8), 1185–1202. <a href="https://doi.org/10.1002/sim.1970">doi:10.1002/sim.1970</a></li>
</ol>
