Ogni numero di questa pagina si può ricostruire: i bandi vengono dal portale del MUR, le dimensioni degli atenei da fonti ufficiali, e il codice che fa i calcoli è pubblico. Qui spieghiamo come si passa dai bandi ai colori della mappa, e cosa quei colori non possono dire.

### Dal bando al tasso

Per ogni università contiamo i posti messi a bando, tenendo sempre separate le tre famiglie di posizioni: un assegno di ricerca e una cattedra non si sommano. Quando un bando non indica quanti posti offre, lo contiamo come uno, perché il numero vero è almeno quello.

I posti vengono poi divisi per la dimensione dell'ateneo, cioè per i docenti e ricercatori in servizio, per gli studenti iscritti o, nel caso delle regioni, per i residenti. Il risultato è un tasso che permette di confrontare atenei grandi e piccoli. Una regione è semplicemente la somma delle sue università, così numeratore e denominatore riguardano sempre gli stessi atenei. Le università telematiche, che hanno studenti in tutta Italia, vengono confrontate con le altre ma non sono attribuite a nessuna regione.

Il periodo è quello che scegli in cima alla pagina: di base va dall'inizio della raccolta a oggi. Non può comunque risalire oltre l'inizio della raccolta: dei bandi pubblicati prima abbiamo visto soltanto quelli ancora aperti, e includerli favorirebbe chi lascia più tempo per candidarsi. Con un periodo inferiore all'anno i confronti risentono della stagionalità dei bandi, e la pagina lo segnala.

### Il confronto con la media nazionale

Sapere che un ateneo bandisce due posti ogni cento docenti dice poco, finché non lo si confronta con l'Italia nel suo insieme. Per questo calcoliamo quanti posti avrebbe bandito se seguisse il tasso nazionale, i posti *attesi*, e misuriamo di quanto quelli reali se ne discostano. La misura è uno z-score: la differenza tra posti osservati e attesi, divisa per la radice quadrata degli attesi.

### Cosa dicono i colori, e quanto fidarsi

La mappa colora ogni regione e ogni università in base a quanto il suo tasso si discosta da quello nazionale: vicino alla media, sopra o sotto di almeno un quarto, oppure il doppio o la metà. Le soglie sono simmetriche in proporzione, perché dimezzare è l'opposto di raddoppiare. Per la precarietà conta invece la distanza, in punti percentuali, dalla quota nazionale.

I colori però non dicono se una differenza è solida. Con numeri piccoli, e soprattutto in una finestra temporale ridotta, le differenze nascono anche per caso: un ateneo può bandire molto in pochi mesi solo perché diversi contratti sono scaduti insieme. Per non scambiare il caso per un privilegio, la colonna «Esito» delle tabelle dice se una differenza è troppo grande per essere spiegata dal caso. Tre accorgimenti rendono questo giudizio prudente.

Il primo riguarda il modo in cui arrivano i posti: non uno alla volta, ma a gruppi, perché un solo bando di dottorato può aprirne trenta. I conteggi oscillano quindi più di quanto farebbero eventi indipendenti, e i margini vengono allargati di conseguenza, con il metodo proposto da Spiegelhalter per confrontare le istituzioni [[1]](#ref-1).

Il secondo riguarda il numero dei confronti. Con cento università, qualcuna supererebbe per caso la soglia abituale del 95%: per questo chiamiamo «molto sopra» o «molto sotto» la media solo le differenze oltre il 99,8%, e semplicemente «sopra» o «sotto» quelle oltre il 95%, come suggerito nello stesso lavoro [[1]](#ref-1).

Il terzo riguarda i casi con troppo pochi dati. Quando un ateneo avrebbe dovuto bandire meno di cinque posti, non lo valutiamo affatto, e la tabella lo segnala come «dati insufficienti per valutare».

Gli intervalli al 95% delle tabelle seguono la stessa logica: sono calcolati con il metodo di Byar per i posti [[2]](#ref-2) e con quello di Wilson per le quote di posizioni precarie [[3]](#ref-3), e allargati allo stesso modo.

### Le fonti

- **Bandi:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), raccolti ogni giorno da PostTheDoc e pubblicati anche come dataset aperto.
- **Docenti, ricercatori e studenti iscritti** per università: [USTAT](https://ustat.mur.gov.it), il portale statistico del MUR (licenza IODL 2.0). Contiamo professori ordinari e associati e ricercatori, a tempo indeterminato e determinato. Le scuole superiori, come la Normale o la SISSA, non hanno iscritti nei dati USTAT e restano fuori solo dal confronto per studente.
- **Residenti** per regione: ISTAT, tramite Eurostat (licenza CC BY 4.0).
- **Mappa:** confini regionali ISTAT da openpolis/geojson-italy (CC BY 4.0) e posizione delle città da OpenStreetMap (ODbL).

### Cosa questi dati non dicono

L'osservatorio mostra dove si bandisce di più e dove di meno, ma non spiega perché. Un tasso alto può dipendere da pensionamenti, piani straordinari, progetti del PNRR o scelte dell'ateneo; uno basso, da bilanci in difficoltà o da un turnover bloccato. Sono differenze da indagare, non da dare per scontate: chiedere a un ateneo perché bandisce così poco, o a una regione perché resta indietro, è esattamente l'uso per cui questi dati sono pubblici. È un punto di partenza per fare domande, non una conclusione.

Vale lo stesso per la finestra di candidatura. La data del bando è quella dell'atto, mentre la pubblicazione sul portale può arrivare qualche giorno dopo: la finestra reale per candidarsi può quindi essere più breve di quella indicata.

### Riferimenti

<ol class="obs-refs">
<li id="ref-1">Spiegelhalter, D. J. (2005). Funnel plots for comparing institutional performance. <em>Statistics in Medicine</em>, 24(8), 1185–1202. <a href="https://doi.org/10.1002/sim.1970">doi:10.1002/sim.1970</a></li>
<li id="ref-2">Breslow, N. E., e Day, N. E. (1987). <em>Statistical Methods in Cancer Research. Volume II: The Design and Analysis of Cohort Studies</em> (IARC Scientific Publications, n. 82). Lione: International Agency for Research on Cancer. Riporta l'approssimazione di Byar all'intervallo esatto di Poisson.</li>
<li id="ref-3">Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. <em>Journal of the American Statistical Association</em>, 22(158), 209–212. <a href="https://doi.org/10.1080/01621459.1927.10502953">doi:10.1080/01621459.1927.10502953</a></li>
</ol>
