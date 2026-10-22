Every number on this page can be checked: the code is public and the data can be downloaded.

### Comparing universities and regions of different sizes

A large university naturally advertises more positions than a small one, so counting positions is not enough to compare them. To make the numbers comparable we relate the positions advertised to the size of each university or region, measured by its teaching and research staff, its enrolled students or its residents. This gives a rate, such as the number of positions per 100 staff. A region adds up the figures of its universities, except online ones, which enrol students across Italy and so belong to no region.

Each rate is then compared with the national average, which gives the expected positions <math><msub><mi>E</mi><mi>i</mi></msub></math>: those that university or region *i* would have advertised had it recruited exactly like the country as a whole.

<math display="block"><msub><mi>E</mi><mi>i</mi></msub><mo>=</mo><msub><mi>D</mi><mi>i</mi></msub><mo>·</mo><mfrac><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>O</mi><mi>j</mi></msub></mrow><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>D</mi><mi>j</mi></msub></mrow></mfrac></math>

Here <math><msub><mi>D</mi><mi>i</mi></msub></math> is the staff, students or residents of *i*, and the fraction is the national rate, that is, all the positions advertised <math><msub><mi>O</mi><mi>j</mi></msub></math> divided by all the denominators. The ratio <math><msub><mi>O</mi><mi>i</mi></msub><mo lspace="0" rspace="0">/</mo><msub><mi>E</mi><mi>i</mi></msub></math> between advertised and expected positions then measures the distance from the average: it is 1 for those in line with it, 2 for those advertising twice as many and 0.5 for those advertising half.

### Which positions are precarious

The positions advertised are split into three groups. Precarious are those with no path to a permanent post: research fellowships, grants and contracts, postdocs and technologists, hired on fixed terms with a project's funds. Researchers and professors form a group of their own. Researchers are on fixed-term contracts too, but since the 2022 reform the standard contract is the tenure-track one (RTT), which leads to an associate professorship. The portal does not tell these researchers apart from those not on the tenure track, such as the researchers funded by the PNRR, so we count them all with the professors: if anything, the precarious share is underestimated. PhDs are a group of their own and do not enter the share.

### Reading the map

The map's colours show this ratio in five bands: half the average or less, at least 20% below, close to the average, at least 25% above, double or more. The bands are symmetric, because halving the average is as large a difference as doubling it. For precarity the colour depends instead on the difference between the share of precarious positions and the national one, with thresholds at 5 and 15 percentage points.

The colour therefore says how far a figure is from the average, but not how reliable that distance is. That is what the intervals are for.

### How far to trust a figure: 95% intervals

The number of positions advertised in a period partly depends on chance, starting with the timing of the calls. When positions are few, a call or two more or less is enough to change the rate a lot, and the figure alone does not say how solid it is.

This is why every figure comes with a 95% interval, which gathers the values compatible with the data observed. The narrower the interval, the more reliable the figure; a wide one means the figure should be read as an indication. When the interval includes the national average, the difference from the average may be due to chance.

For positions the interval is computed with Byar's approximation [[1]](#ref-1) based on the Poisson distribution, the model usually used to count random events. For the precarious share we use Wilson's interval [[2]](#ref-2), which stays reliable with few positions or with shares close to 0% or 100%.

Both methods assume that each position is advertised independently of the others. A single call, however, can open many positions at once: when the positions of a university or region come from a few large calls, as often happens with PhDs, the interval is narrower than it should be.

### What these data do not say

The observatory shows where more positions are advertised and where fewer, but not why. A high rate can come from retirements, extraordinary hiring plans, PNRR projects or the university's own choices; a low one, from strained budgets or frozen turnover. These are differences to look into, not to take for granted: asking a university why it advertises so little, or a region why it lags behind, is exactly what these data are public for. It is a starting point for questions, not a conclusion.

Each call enters the period by its date. On the first day of the collection we also found calls that had been open for weeks or months: those whose date the portal does not give cannot be placed in any period and are not counted. A call without a date found on a later day is counted from the day it appeared.

Finally, the intervals only account for chance, not for inaccuracies in the data: a call that does not state its number of positions, for instance, is counted as a single position.

### Sources

- **Calls:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), collected every day by PostTheDoc and also published as an open dataset.
- **Teaching and research staff and enrolled students** per university: [USTAT](https://ustat.mur.gov.it), MUR's statistics portal (IODL 2.0 licence). We count full and associate professors and researchers, permanent and fixed-term. The special schools, such as the Scuola Normale or SISSA, have no enrolled students in USTAT and are left out of the per-student comparison only.
- **Residents** per region: ISTAT, through Eurostat (CC BY 4.0 licence).
- **Map:** ISTAT regional boundaries from openpolis/geojson-italy (CC BY 4.0) and city locations from OpenStreetMap (ODbL).

### References

<ol class="obs-refs">
<li id="ref-1">Breslow, N. E., and Day, N. E. (1987). <em>Statistical Methods in Cancer Research. Volume II: The Design and Analysis of Cohort Studies</em> (IARC Scientific Publications, no. 82). Lyon: International Agency for Research on Cancer. Gives Byar's approximation to the exact Poisson interval.</li>
<li id="ref-2">Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. <em>Journal of the American Statistical Association</em>, 22(158), 209–212. <a href="https://doi.org/10.1080/01621459.1927.10502953">doi:10.1080/01621459.1927.10502953</a></li>
</ol>
