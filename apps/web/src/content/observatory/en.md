### What is counted

- **Positions, not calls.** A call with three positions counts three. The number comes from the MUR portal (its list or the call's page). When a call does not state it, it counts as one position: the real number is at least this, and the page says how many calls this applies to.
- **Three groups, never added together:** the permanent track (researchers, professors, technologists), precarious post-graduate work (research fellowships and contracts, postdocs) and PhDs. A fellowship and a professorship are not the same thing.
- **The period:** the last twelve months by the date of the call (the date we found it, if missing), and never before collection began: of earlier calls we only saw those still open, and counting them would favour whoever leaves more time to apply. Calls withdrawn before their deadline do not count.
- **Universities with a denominator.** Research institutes and AFAM have no comparable figure and only appear with the positions they advertised. Online universities are compared with the other universities but stay out of the regions: their students come from all over Italy.

### The rate and the comparison

For each university or region: **rate = positions ÷ denominator**, per 100 teaching and research staff, per 1,000 students or per 100,000 residents. A region is the sum of its universities: the numerator and the denominator always cover the same universities.

The **expected positions** are those it would have at the national rate: denominator × national rate. Observed and expected positions are compared with a **z-score**, (observed − expected) ÷ √expected.

### Why grey

With small numbers, differences also come by chance. Not to mistake chance for privilege:

- **Overdispersion.** Positions do not come one at a time (one PhD call can open thirty), so they vary more than independent events. Following Spiegelhalter (*Funnel plots for comparing institutional performance*, 2005), z-scores are divided by √φ, where φ is the mean of their squares after capping the most extreme 10% on each side (if φ > 1).
- **Many comparisons.** With a hundred universities some differences come out by chance: "well above/below" means beyond 99.8% (|z| ≥ 3.09), "above/below" beyond 95% (|z| ≥ 1.96). Everything else is **in line**, in grey.
- **Too little data.** Below 5 expected positions there is no judgement.
- **The 95% interval** of a rate is Byar's for Poisson counts, widened by √φ.

The precarious share follows the same scheme for proportions (Wilson's interval).

### Sources

- **Calls:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), collected every day by PostTheDoc. The full dataset is open.
- **Teaching and research staff** (full and associate professors, permanent and fixed-term researchers) and **enrolled students** per university: [USTAT](https://ustat.mur.gov.it), MUR (IODL 2.0 licence). The special schools (Normale, Sant'Anna, SISSA...) have no enrolled students in USTAT and stay out of the per-student comparison.
- **Residents** per region: ISTAT, through Eurostat (CC BY 4.0).
- **Map:** ISTAT boundaries from openpolis/geojson-italy (CC BY 4.0); cities from OpenStreetMap (ODbL).

### What it does not say

- **It does not measure research funding.** It measures positions advertised on the MUR portal, which does not collect every call of every institution.
- **It does not explain causes.** A high rate can come from retirements, extraordinary plans, PNRR projects or the university's choices: it is a starting point for questions, not a conclusion.
- **The date of a call** is that of its act: publication on the portal may come later, and the real window to apply be shorter.
