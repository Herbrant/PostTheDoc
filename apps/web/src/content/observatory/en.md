Every number on this page can be rebuilt: the calls come from the MUR portal, the size of each university from official sources, and the code that does the sums is public. Here is how the calls become the colours on the map, and what those colours cannot tell.

### From calls to rates

For each university we count the positions advertised, always keeping the three families of positions apart: a research fellowship and a professorship do not add up. When a call does not say how many positions it offers, we count it as one, since the real number is at least that.

The positions are then divided by the size of the university: its teaching and research staff, its enrolled students or, for regions, their residents. The result is a rate that lets large and small universities be compared. A region is simply the sum of its universities, so the numerator and the denominator always cover the same institutions. Online universities, whose students live all over Italy, are compared with the others but belong to no region.

The period covers the last twelve months, but goes no further back than the start of the collection: of the calls published earlier we only saw those still open, and including them would favour whoever leaves more time to apply.

### The comparison with the national average

Knowing that a university advertises two positions per hundred staff means little until it is set against Italy as a whole. So we work out how many positions it would have advertised at the national rate, the *expected* positions, and measure how far the real ones are from it. The measure is a z-score: the difference between observed and expected positions, divided by the square root of the expected ones.

### Why the map is mostly grey

With small numbers, differences also come by chance: a university may advertise a lot in a few months only because several contracts ended together. Not to mistake chance for privilege, the map colours a region or a university only when the difference is too large for chance to explain. Three precautions keep this threshold cautious.

The first concerns the way positions arrive: not one at a time but in batches, since a single PhD call can open thirty of them. Counts therefore swing more than independent events would, and the margins are widened accordingly, with the method David Spiegelhalter proposed for comparing institutions (*Funnel plots for comparing institutional performance*, 2005).

The second concerns the number of comparisons. With a hundred universities, some would cross the usual 95% threshold by chance: so only differences beyond 99.8% are called "well above" or "well below" the average, and those beyond 95% simply "above" or "below".

The third concerns cases with too little data. When a university would have been expected to advertise fewer than five positions, it is not judged at all, and the map shows it with a dashed outline.

The 95% intervals in the tables follow the same logic: they use Byar's method for positions and Wilson's for the shares of precarious positions, widened in the same way.

### Sources

- **Calls:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), collected every day by PostTheDoc and also published as an open dataset.
- **Teaching and research staff and enrolled students** per university: [USTAT](https://ustat.mur.gov.it), MUR's statistics portal (IODL 2.0 licence). We count full and associate professors and researchers, permanent and fixed-term. The special schools, such as the Scuola Normale or SISSA, have no enrolled students in USTAT and are left out of the per-student comparison only.
- **Residents** per region: ISTAT, through Eurostat (CC BY 4.0 licence).
- **Map:** ISTAT regional boundaries from openpolis/geojson-italy (CC BY 4.0) and city locations from OpenStreetMap (ODbL).

### What these data do not say

The observatory only sees the calls published on the MUR portal, which does not collect every call of every institution. Above all, it does not explain causes: a high rate can come from retirements, extraordinary hiring plans, PNRR projects or the university's own choices. It is a starting point for questions, not a conclusion.

The same goes for the application window. The date of a call is that of its act, while publication on the portal may come a few days later: the real window to apply may therefore be shorter than the one shown.
