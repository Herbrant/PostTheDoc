Il codice è pubblico e i dati sono scaricabili: ogni numero di questa pagina può essere ricostruito.

### Confrontare atenei e regioni di dimensioni diverse

Un ateneo grande bandisce più posti di uno piccolo solo perché è più grande: contare i posti non basta per confrontarli.

Per questo dividiamo i posti banditi per la dimensione di ciascuna unità (un'università o una regione): docenti e ricercatori, studenti iscritti o residenti. Il risultato è un tasso, per esempio posti ogni 100 docenti. Una regione somma i dati delle sue università; le università telematiche, con studenti da tutta Italia, non appartengono a nessuna regione.

Ogni tasso è confrontato con la media nazionale. Da questa ricaviamo i posti attesi <math><msub><mi>E</mi><mi>i</mi></msub></math>: quelli che l'unità avrebbe bandito se reclutasse esattamente come la media del paese, dati i suoi <math><msub><mi>D</mi><mi>i</mi></msub></math> docenti, studenti o residenti e i posti <math><msub><mi>O</mi><mi>j</mi></msub></math> banditi da tutte le unità:

<math display="block"><msub><mi>E</mi><mi>i</mi></msub><mo>=</mo><msub><mi>D</mi><mi>i</mi></msub><mo>·</mo><mfrac><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>O</mi><mi>j</mi></msub></mrow><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>D</mi><mi>j</mi></msub></mrow></mfrac></math>

Il rapporto <math><msub><mi>O</mi><mi>i</mi></msub><mo lspace="0" rspace="0">/</mo><msub><mi>E</mi><mi>i</mi></msub></math> tra posti banditi e attesi dice quanto l'unità si discosta dalla media: 1 è la media, 2 il doppio, 0,5 la metà.

### Leggere la mappa

La mappa colora ogni unità secondo quel rapporto, in cinque fasce: la metà della media o meno; almeno il 20% sotto; vicino alla media; almeno il 25% sopra; il doppio o più. Le fasce sono simmetriche: la metà dista dalla media quanto il doppio. Per la precarietà conta invece la differenza tra la quota dell'unità e quella nazionale: entro 5 punti percentuali, tra 5 e 15, oltre 15.

Il colore mostra solo quanto un'unità si allontana dalla media, non quanto quella distanza sia affidabile. Per questo servono gli intervalli.

### Quanto fidarsi di un valore: gli intervalli al 95%

I posti banditi in un periodo dipendono anche dal caso, per esempio da quando esce un bando. Se un'unità ha pochi posti, bastano pochi bandi in più o in meno per cambiare molto il suo tasso: il valore da solo non dice quanto sia solido.

Accanto a ogni valore riportiamo quindi un intervallo al 95%: l'insieme dei valori compatibili con i dati osservati. Un intervallo stretto indica un valore solido, uno largo un valore solo indicativo. Se l'intervallo comprende la media nazionale, la differenza dalla media può essere dovuta al caso.

Per i posti usiamo l'approssimazione di Byar [[1]](#ref-1) dell'intervallo di Poisson, il modello abituale per contare eventi che accadono a caso. Per la quota precaria usiamo l'intervallo di Wilson [[2]](#ref-2), che resta affidabile anche con pochi posti o con quote vicine allo 0% o al 100%.

### Quando i posti arrivano a gruppi

Questi metodi presuppongono che ogni posto sia deciso indipendentemente dagli altri. In realtà un solo bando può aprire molti posti insieme, e i numeri variano più di quanto i modelli prevedono. Senza correzione gli intervalli risulterebbero troppo stretti, cioè più precisi di quanto i dati permettono.

Seguendo [[3]](#ref-3), misuriamo questa variabilità in eccesso, detta sovradispersione. Per ogni unità calcoliamo lo scarto dalla media nazionale in unità standard, <math><msub><mi>z</mi><mi>i</mi></msub></math> (per la quota precaria, il suo equivalente per le proporzioni). Se i posti fossero indipendenti, la media dei quadrati di questi scarti sarebbe circa 1; il valore osservato è il fattore <math><mover accent="true"><mi>φ</mi><mo>^</mo></mover></math>:

<math display="block"><msub><mi>z</mi><mi>i</mi></msub><mo>=</mo><mfrac><mrow><msub><mi>O</mi><mi>i</mi></msub><mo>−</mo><msub><mi>E</mi><mi>i</mi></msub></mrow><msqrt><msub><mi>E</mi><mi>i</mi></msub></msqrt></mfrac><mo>,</mo><mspace width="2em"/><mover accent="true"><mi>φ</mi><mo>^</mo></mover><mo>=</mo><mi>max</mi><mrow><mo>(</mo><mn>1</mn><mo>,</mo><mfrac><mn>1</mn><mi>n</mi></mfrac><munder><mo>∑</mo><mi>i</mi></munder><msubsup><mover accent="true"><mi>z</mi><mo>~</mo></mover><mi>i</mi><mn>2</mn></msubsup><mo>)</mo></mrow></math>

Se <math><mover accent="true"><mi>φ</mi><mo>^</mo></mover></math> supera 1, ogni intervallo viene allargato di <math><msqrt><mover accent="true"><mi>φ</mi><mo>^</mo></mover></msqrt></math> attorno al valore osservato. Per evitare che un'unità anomala allarghi gli intervalli di tutte le altre, il 10% degli scarti più alti e il 10% dei più bassi vengono ridotti ai valori più vicini (<math><msub><mover accent="true"><mi>z</mi><mo>~</mo></mover><mi>i</mi></msub></math>). Contano solo le unità con almeno 5 posti attesi (per la quota, almeno 5 precari e 5 strutturati attesi), perché sotto questa soglia lo scarto è troppo instabile; se sono meno di dieci, non si applica alcuna correzione.

### Cosa questi dati non dicono

L'osservatorio mostra dove si bandisce di più e dove di meno, ma non spiega perché. Un tasso alto può dipendere da pensionamenti, piani straordinari, progetti del PNRR o scelte dell'ateneo; uno basso, da bilanci in difficoltà o da un turnover bloccato. Sono differenze da indagare, non da dare per scontate: chiedere a un ateneo perché bandisce così poco, o a una regione perché resta indietro, è esattamente l'uso per cui questi dati sono pubblici. È un punto di partenza per fare domande, non una conclusione.

Gli intervalli tengono conto solo del caso, non di errori nei dati: un bando che non indica il numero di posti, per esempio, conta come un posto solo.

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
