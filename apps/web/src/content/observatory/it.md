Questa sezione descrive come sono calcolati i valori della pagina. Il codice è pubblico e i dati sono scaricabili, quindi ogni numero può essere ricostruito.

### Tasso e posti attesi

Per l'unità *i* (un'università o una regione), con <math><msub><mi>O</mi><mi>i</mi></msub></math> posti osservati e denominatore <math><msub><mi>D</mi><mi>i</mi></msub></math> (docenti e ricercatori, studenti iscritti o residenti), il tasso è

<math display="block"><msub><mi>r</mi><mi>i</mi></msub><mo>=</mo><mi>k</mi><mo>·</mo><mfrac><msub><mi>O</mi><mi>i</mi></msub><msub><mi>D</mi><mi>i</mi></msub></mfrac><mo>,</mo><mspace width="1em"/><mi>k</mi><mo>∈</mo><mo>{</mo><msup><mn>10</mn><mn>2</mn></msup><mo>,</mo><msup><mn>10</mn><mn>3</mn></msup><mo>,</mo><msup><mn>10</mn><mn>5</mn></msup><mo>}</mo></math>

Una regione somma numeratori e denominatori delle sue università; le università telematiche, con iscritti in tutto il paese, non sono attribuite ad alcuna regione. Il riferimento è il tasso nazionale, calcolato sulle stesse unità, da cui derivano i posti attesi:

<math display="block"><msub><mi>E</mi><mi>i</mi></msub><mo>=</mo><msub><mi>D</mi><mi>i</mi></msub><mo>·</mo><mfrac><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>O</mi><mi>j</mi></msub></mrow><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>D</mi><mi>j</mi></msub></mrow></mfrac></math>

### Colori della mappa

La mappa rappresenta il rapporto <math><msub><mi>O</mi><mi>i</mi></msub><mo lspace="0" rspace="0">/</mo><msub><mi>E</mi><mi>i</mi></msub></math> in cinque classi, simmetriche in scala logaritmica: fino a 0,5; da 0,5 a 0,8; tra 0,8 e 1,25; da 1,25 a 2; da 2 in su. Per la precarietà la classe dipende dalla differenza tra la quota dell'unità e quella nazionale: entro 5 punti percentuali, tra 5 e 15, oltre 15. I colori descrivono l'entità dello scostamento, non la sua significatività.

### Intervalli al 95%

L'intervallo di <math><msub><mi>O</mi><mi>i</mi></msub></math> usa l'approssimazione di Byar all'intervallo esatto di Poisson [[1]](#ref-1), con <math><mi>z</mi><mo>=</mo><mn>1,96</mn></math>:

<math display="block"><msub><mi>O</mi><mi>L</mi></msub><mo>=</mo><mi>O</mi><msup><mrow><mo>(</mo><mn>1</mn><mo>−</mo><mn>1</mn><mo lspace="0" rspace="0">/</mo><mrow><mo>(</mo><mn>9</mn><mi>O</mi><mo>)</mo></mrow><mo>−</mo><mi>z</mi><mo lspace="0" rspace="0">/</mo><mrow><mo>(</mo><mn>3</mn><msqrt><mi>O</mi></msqrt><mo>)</mo></mrow><mo>)</mo></mrow><mn>3</mn></msup><mo>,</mo><mspace width="1em"/><msub><mi>O</mi><mi>U</mi></msub><mo>=</mo><mrow><mo>(</mo><mi>O</mi><mo>+</mo><mn>1</mn><mo>)</mo></mrow><msup><mrow><mo>(</mo><mn>1</mn><mo>−</mo><mn>1</mn><mo lspace="0" rspace="0">/</mo><mrow><mo>(</mo><mn>9</mn><mo>(</mo><mi>O</mi><mo>+</mo><mn>1</mn><mo>)</mo><mo>)</mo></mrow><mo>+</mo><mi>z</mi><mo lspace="0" rspace="0">/</mo><mrow><mo>(</mo><mn>3</mn><msqrt><mi>O</mi><mo>+</mo><mn>1</mn></msqrt><mo>)</mo></mrow><mo>)</mo></mrow><mn>3</mn></msup></math>

Per la quota precaria, con <math><msub><mi>P</mi><mi>i</mi></msub></math> posti precari su <math><msub><mi>N</mi><mi>i</mi></msub></math> posti precari e strutturati, l'intervallo è quello di Wilson [[2]](#ref-2).

I posti non sono eventi indipendenti, perché un bando può aprirne molti insieme, e la varianza osservata supera quella teorica. Seguendo [[3]](#ref-3), l'ampiezza di ogni intervallo attorno al valore osservato è moltiplicata per <math><msqrt><mover accent="true"><mi>φ</mi><mo>^</mo></mover></msqrt></math>, dove <math><mover accent="true"><mi>φ</mi><mo>^</mo></mover></math> è un fattore di sovradispersione stimato dagli scarti standardizzati dal riferimento nazionale (<math><mi>p</mi></math> è la quota precaria nazionale):

<math display="block"><msub><mi>z</mi><mi>i</mi></msub><mo>=</mo><mfrac><mrow><msub><mi>O</mi><mi>i</mi></msub><mo>−</mo><msub><mi>E</mi><mi>i</mi></msub></mrow><msqrt><msub><mi>E</mi><mi>i</mi></msub></msqrt></mfrac><mo>,</mo><mspace width="2em"/><msub><mi>z</mi><mi>i</mi></msub><mo>=</mo><mfrac><mrow><msub><mi>P</mi><mi>i</mi></msub><mo>−</mo><msub><mi>N</mi><mi>i</mi></msub><mi>p</mi></mrow><msqrt><mrow><msub><mi>N</mi><mi>i</mi></msub><mi>p</mi><mrow><mo>(</mo><mn>1</mn><mo>−</mo><mi>p</mi><mo>)</mo></mrow></mrow></msqrt></mfrac></math>

<math display="block"><mover accent="true"><mi>φ</mi><mo>^</mo></mover><mo>=</mo><mi>max</mi><mrow><mo>(</mo><mn>1</mn><mo>,</mo><mfrac><mn>1</mn><mi>n</mi></mfrac><munder><mo>∑</mo><mi>i</mi></munder><msubsup><mover accent="true"><mi>z</mi><mo>~</mo></mover><mi>i</mi><mn>2</mn></msubsup><mo>)</mo></mrow></math>

con <math><msub><mover accent="true"><mi>z</mi><mo>~</mo></mover><mi>i</mi></msub></math> gli scarti winsorizzati al 10% per coda. Entrano nella stima solo le unità con <math><msub><mi>E</mi><mi>i</mi></msub><mo>≥</mo><mn>5</mn></math> (per la quota, <math><msub><mi>N</mi><mi>i</mi></msub><mi>p</mi><mo>≥</mo><mn>5</mn></math> e <math><msub><mi>N</mi><mi>i</mi></msub><mrow><mo>(</mo><mn>1</mn><mo>−</mo><mi>p</mi><mo>)</mo></mrow><mo>≥</mo><mn>5</mn></math>); se sono meno di dieci, <math><mover accent="true"><mi>φ</mi><mo>^</mo></mover><mo>=</mo><mn>1</mn></math>.

### Cosa questi dati non dicono

L'osservatorio mostra dove si bandisce di più e dove di meno, ma non spiega perché. Un tasso alto può dipendere da pensionamenti, piani straordinari, progetti del PNRR o scelte dell'ateneo; uno basso, da bilanci in difficoltà o da un turnover bloccato. Sono differenze da indagare, non da dare per scontate: chiedere a un ateneo perché bandisce così poco, o a una regione perché resta indietro, è esattamente l'uso per cui questi dati sono pubblici. È un punto di partenza per fare domande, non una conclusione.

Vale lo stesso per la finestra di candidatura. La data del bando è quella dell'atto, mentre la pubblicazione sul portale può arrivare qualche giorno dopo: la finestra reale per candidarsi può quindi essere più breve di quella indicata.

### Le fonti

- **Bandi:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), raccolti ogni giorno da PostTheDoc e pubblicati anche come dataset aperto.
- **Docenti, ricercatori e studenti iscritti** per università: [USTAT](https://ustat.mur.gov.it), il portale statistico del MUR (licenza IODL 2.0). Contiamo professori ordinari e associati e ricercatori, a tempo indeterminato e determinato. Le scuole superiori, come la Normale o la SISSA, non hanno iscritti nei dati USTAT e restano fuori solo dal confronto per studente.
- **Residenti** per regione: ISTAT, tramite Eurostat (licenza CC BY 4.0).
- **Mappa:** confini regionali ISTAT da openpolis/geojson-italy (CC BY 4.0) e posizione delle città da OpenStreetMap (ODbL).

### Riferimenti

<ol class="obs-refs">
<li id="ref-1">Breslow, N. E., e Day, N. E. (1987). <em>Statistical Methods in Cancer Research. Volume II: The Design and Analysis of Cohort Studies</em> (IARC Scientific Publications, n. 82). Lione: International Agency for Research on Cancer. Riporta l'approssimazione di Byar all'intervallo esatto di Poisson.</li>
<li id="ref-2">Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. <em>Journal of the American Statistical Association</em>, 22(158), 209–212. <a href="https://doi.org/10.1080/01621459.1927.10502953">doi:10.1080/01621459.1927.10502953</a></li>
<li id="ref-3">Spiegelhalter, D. J. (2005). Funnel plots for comparing institutional performance. <em>Statistics in Medicine</em>, 24(8), 1185–1202. <a href="https://doi.org/10.1002/sim.1970">doi:10.1002/sim.1970</a></li>
</ol>
