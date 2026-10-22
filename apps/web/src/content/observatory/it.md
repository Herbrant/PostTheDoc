Ogni numero di questa pagina può essere verificato: il codice è pubblico e i dati si possono scaricare.

### Confrontare atenei e regioni di dimensioni diverse

Un ateneo grande bandisce naturalmente più posti di uno piccolo, perciò il semplice conteggio dei posti non basta a confrontarli. Per rendere i numeri confrontabili rapportiamo i posti banditi alle dimensioni di ciascun ateneo o regione, misurate dal numero di docenti e ricercatori, di studenti iscritti o di residenti. Si ottiene così un tasso, come il numero di posti ogni 100 docenti. Per una regione si sommano i dati delle sue università, escluse le telematiche, che hanno iscritti in tutta Italia e non appartengono quindi a nessuna regione.

Ogni tasso viene poi confrontato con la media nazionale, da cui si ricavano i posti attesi <math><msub><mi>E</mi><mi>i</mi></msub></math>: quelli che l'ateneo o la regione *i* avrebbe bandito se avesse reclutato esattamente come la media del paese.

<math display="block"><msub><mi>E</mi><mi>i</mi></msub><mo>=</mo><msub><mi>D</mi><mi>i</mi></msub><mo>·</mo><mfrac><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>O</mi><mi>j</mi></msub></mrow><mrow><munder><mo>∑</mo><mi>j</mi></munder><msub><mi>D</mi><mi>j</mi></msub></mrow></mfrac></math>

Qui <math><msub><mi>D</mi><mi>i</mi></msub></math> indica i docenti, gli studenti o i residenti di *i*, mentre la frazione è il tasso nazionale, cioè il totale dei posti banditi <math><msub><mi>O</mi><mi>j</mi></msub></math> diviso per il totale dei denominatori. Il rapporto <math><msub><mi>O</mi><mi>i</mi></msub><mo lspace="0" rspace="0">/</mo><msub><mi>E</mi><mi>i</mi></msub></math> fra posti banditi e posti attesi misura infine lo scostamento dalla media: vale 1 per chi è in linea, 2 per chi bandisce il doppio e 0,5 per chi bandisce la metà.

### Quali posizioni sono precarie

Le posizioni bandite sono divise in tre gruppi. Sono precarie quelle senza un percorso verso il ruolo: assegni, incarichi e contratti di ricerca, post-doc e tecnologi, assunti a tempo determinato sui fondi di un progetto. Ricercatori e professori formano un gruppo a parte. Anche i ricercatori hanno un contratto a tempo determinato, ma dalla riforma del 2022 il contratto ordinario è quello in tenure track (RTT), che porta al ruolo di professore associato. Il portale non distingue questi ricercatori da quelli senza tenure track, come i ricercatori finanziati dal PNRR, perciò li contiamo tutti con i professori: se mai, la quota precaria è sottostimata. Il dottorato resta un gruppo a sé e non entra nella quota.

### Leggere la mappa

I colori della mappa riproducono questo rapporto in cinque fasce: dalla metà della media in giù, almeno il 20% sotto la media, vicino alla media, almeno il 25% sopra, dal doppio in su. Le fasce sono simmetriche, perché dimezzare la media è uno scostamento grande quanto raddoppiarla. Per la precarietà il colore dipende invece dalla differenza fra la quota di posizioni precarie e quella nazionale, con soglie a 5 e a 15 punti percentuali.

Il colore dice dunque quanto un valore si allontana dalla media, ma non quanto questa distanza sia affidabile. A questo servono gli intervalli.

### Quanto fidarsi di un valore: gli intervalli al 95%

Il numero di posti banditi in un periodo dipende in parte dal caso, a cominciare dai tempi in cui escono i bandi. Quando i posti sono pochi basta qualche bando in più o in meno per cambiare molto il tasso, e il valore, da solo, non dice quanto sia solido.

Per questo ogni valore è accompagnato da un intervallo al 95%, che raccoglie i valori compatibili con i dati osservati. Più l'intervallo è stretto, più il valore è affidabile; se è largo, il valore va letto come un'indicazione. Quando l'intervallo comprende la media nazionale, la differenza dalla media potrebbe essere dovuta al caso.

Per i posti l'intervallo si calcola con l'approssimazione di Byar [[1]](#ref-1) basata sulla distribuzione di Poisson, il modello con cui si contano di solito gli eventi casuali. Per la quota precaria si usa l'intervallo di Wilson [[2]](#ref-2), che resta affidabile anche con pochi posti o con quote vicine allo 0% o al 100%.

Entrambi i metodi presuppongono che ogni posto venga bandito indipendentemente dagli altri. Un solo bando, però, può aprire molti posti insieme: quando i posti di un ateneo o di una regione vengono da pochi bandi grandi, come accade spesso per il dottorato, l'intervallo è più stretto di quanto dovrebbe.

### Cosa questi dati non dicono

L'osservatorio mostra dove si bandisce di più e dove di meno, ma non spiega perché. Un tasso alto può dipendere da pensionamenti, piani straordinari, progetti del PNRR o scelte dell'ateneo; uno basso, da bilanci in difficoltà o da un turnover bloccato. Sono differenze da indagare, non da dare per scontate: chiedere a un ateneo perché bandisce così poco, o a una regione perché resta indietro, è esattamente l'uso per cui questi dati sono pubblici. È un punto di partenza per fare domande, non una conclusione.

Ogni bando entra nel periodo in base alla sua data. Il primo giorno della raccolta abbiamo trovato anche bandi aperti da settimane o mesi: quelli di cui il portale non indica la data non si possono collocare in nessun periodo e non sono contati. Un bando senza data trovato in un giorno successivo è invece contato dal giorno in cui è comparso.

Gli intervalli, infine, tengono conto soltanto del caso e non di eventuali imprecisioni nei dati: un bando che non indica il numero di posti, per esempio, viene contato come un solo posto.

### Le fonti

- **Bandi:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), raccolti ogni giorno da PostTheDoc e pubblicati anche come dataset aperto.
- **Docenti, ricercatori e studenti iscritti** per università: [USTAT](https://ustat.mur.gov.it), il portale statistico del MUR (licenza IODL 2.0). Contiamo professori ordinari e associati e ricercatori, a tempo indeterminato e determinato. Le scuole superiori, come la Normale o la SISSA, non hanno iscritti nei dati USTAT e restano fuori solo dal confronto per studente.
- **Residenti** per regione: ISTAT, tramite Eurostat (licenza CC BY 4.0).
- **Mappa:** confini regionali ISTAT da openpolis/geojson-italy (CC BY 4.0) e posizione delle città da OpenStreetMap (ODbL).

### Riferimenti

<ol class="obs-refs">
<li id="ref-1">Breslow, N. E., e Day, N. E. (1987). <em>Statistical Methods in Cancer Research. Volume II: The Design and Analysis of Cohort Studies</em> (IARC Scientific Publications, n. 82). Lione: International Agency for Research on Cancer. Riporta l'approssimazione di Byar all'intervallo esatto di Poisson.</li>
<li id="ref-2">Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. <em>Journal of the American Statistical Association</em>, 22(158), 209–212. <a href="https://doi.org/10.1080/01621459.1927.10502953">doi:10.1080/01621459.1927.10502953</a></li>
</ol>
