The code is public and the data can be downloaded: every number on this page can be rebuilt.

### Comparing universities and regions of different sizes

A large university advertises more positions than a small one just because it is larger: counting positions is not enough to compare them.

So we divide the positions advertised by the size of each unit (a university or a region): teaching and research staff, enrolled students or residents. The result is a rate, for instance positions per 100 staff. A region adds up the figures of its universities; online universities, with students from all over Italy, belong to no region.

Each rate is compared with the national average. From it we derive the expected positions <math><msub><mi>E</mi><mi>i</mi></msub></math>: those the unit would have advertised if it recruited exactly like the national average, given its <math><msub><mi>D</mi><mi>i</mi></msub></math> staff, students or residents and the positions <math><msub><mi>O</mi><mi>j</mi></msub></math> advertised by all units:

<math display="block"><msub><mi>E</mi><mi>i</mi></msub><mo>=</mo><msub><mi>D</mi><mi>i</mi></msub><mo>·</mo><mfrac><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>O</mi><mi>j</mi></msub></mrow><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>D</mi><mi>j</mi></msub></mrow></mfrac></math>

The ratio <math><msub><mi>O</mi><mi>i</mi></msub><mo lspace="0" rspace="0">/</mo><msub><mi>E</mi><mi>i</mi></msub></math> between advertised and expected positions says how far the unit is from the average: 1 is the average, 2 double, 0.5 half.

### Reading the map

The map colours each unit by that ratio, in five bands: half the average or less; at least 20% below; close to the average; at least 25% above; double or more. The bands are symmetric: half is as far from the average as double. For precarity what counts is the difference between the unit's share and the national one: within 5 percentage points, between 5 and 15, beyond 15.

The colour only shows how far a unit is from the average, not how reliable that distance is. That is what the intervals are for.

### How far to trust a figure: 95% intervals

The positions advertised in a period also depend on chance, for instance on when a call comes out. If a unit has few positions, a few calls more or less are enough to change its rate a lot: the figure alone does not say how solid it is.

Next to each figure we therefore show a 95% interval: the range of values compatible with the data observed. A narrow interval means a solid figure, a wide one a figure that is only indicative. If the interval includes the national average, the difference from the average may be due to chance.

For positions we use Byar's approximation [[1]](#ref-1) to the Poisson interval, the usual model for counting events that happen by chance. For the precarious share we use Wilson's interval [[2]](#ref-2), which stays reliable with few positions or with shares close to 0% or 100%.

### When positions come in batches

These methods assume that each position is decided independently of the others. In fact a single call can open many positions at once, and the numbers vary more than the models expect. Without a correction the intervals would be too narrow, that is, more precise than the data allow.

Following [[3]](#ref-3), we measure this excess variability, called overdispersion. For each unit we compute its deviation from the national average in standard units, <math><msub><mi>z</mi><mi>i</mi></msub></math> (for the precarious share, its equivalent for proportions). If positions were independent, the mean square of these deviations would be about 1; the observed value is the factor <math><mover accent="true"><mi>φ</mi><mo>^</mo></mover></math>:

<math display="block"><msub><mi>z</mi><mi>i</mi></msub><mo>=</mo><mfrac><mrow><msub><mi>O</mi><mi>i</mi></msub><mo>−</mo><msub><mi>E</mi><mi>i</mi></msub></mrow><msqrt><msub><mi>E</mi><mi>i</mi></msub></msqrt></mfrac><mo>,</mo><mspace width="2em"/><mover accent="true"><mi>φ</mi><mo>^</mo></mover><mo>=</mo><mi>max</mi><mrow><mo>(</mo><mn>1</mn><mo>,</mo><mfrac><mn>1</mn><mi>n</mi></mfrac><munder><mo>∑</mo><mi>i</mi></munder><msubsup><mover accent="true"><mi>z</mi><mo>~</mo></mover><mi>i</mi><mn>2</mn></msubsup><mo>)</mo></mrow></math>

If <math><mover accent="true"><mi>φ</mi><mo>^</mo></mover></math> exceeds 1, each interval is widened by <math><msqrt><mover accent="true"><mi>φ</mi><mo>^</mo></mover></msqrt></math> around the observed figure. To keep one unusual unit from widening everyone else's intervals, the highest 10% and the lowest 10% of the deviations are brought back to the nearest values (<math><msub><mover accent="true"><mi>z</mi><mo>~</mo></mover><mi>i</mi></msub></math>). Only units with at least 5 expected positions count (for the share, at least 5 expected precarious and 5 permanent ones), because below that the deviation is too unstable; if there are fewer than ten, no correction is applied.

### What these data do not say

The observatory shows where more positions are advertised and where fewer, but not why. A high rate can come from retirements, extraordinary hiring plans, PNRR projects or the university's own choices; a low one, from strained budgets or frozen turnover. These are differences to look into, not to take for granted: asking a university why it advertises so little, or a region why it lags behind, is exactly what these data are public for. It is a starting point for questions, not a conclusion.

The intervals only account for chance, not for errors in the data: a call that does not state its number of positions, for instance, counts as a single one.

The same goes for the application window. The date of a call is that of its act, while publication on the portal may come a few days later: the real window to apply may therefore be shorter than the one shown.

### Sources

- **Calls:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), collected every day by PostTheDoc and also published as an open dataset.
- **Teaching and research staff and enrolled students** per university: [USTAT](https://ustat.mur.gov.it), MUR's statistics portal (IODL 2.0 licence). We count full and associate professors and researchers, permanent and fixed-term. The special schools, such as the Scuola Normale or SISSA, have no enrolled students in USTAT and are left out of the per-student comparison only.
- **Residents** per region: ISTAT, through Eurostat (CC BY 4.0 licence).
- **Map:** ISTAT regional boundaries from openpolis/geojson-italy (CC BY 4.0) and city locations from OpenStreetMap (ODbL).

### References

<ol class="obs-refs">
<li id="ref-1">Breslow, N. E., and Day, N. E. (1987). <em>Statistical Methods in Cancer Research. Volume II: The Design and Analysis of Cohort Studies</em> (IARC Scientific Publications, no. 82). Lyon: International Agency for Research on Cancer. Gives Byar's approximation to the exact Poisson interval.</li>
<li id="ref-2">Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. <em>Journal of the American Statistical Association</em>, 22(158), 209–212. <a href="https://doi.org/10.1080/01621459.1927.10502953">doi:10.1080/01621459.1927.10502953</a></li>
<li id="ref-3">Spiegelhalter, D. J. (2005). Funnel plots for comparing institutional performance. <em>Statistics in Medicine</em>, 24(8), 1185–1202. <a href="https://doi.org/10.1002/sim.1970">doi:10.1002/sim.1970</a></li>
</ol>
