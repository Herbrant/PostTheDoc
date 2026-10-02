Ogni numero di questa pagina si può ricostruire: i bandi vengono dal portale del MUR, le dimensioni degli atenei da fonti ufficiali, e il codice che fa i calcoli è pubblico. Qui spieghiamo come si passa dai bandi ai colori della mappa, e cosa quei colori non possono dire.

### Dal bando al tasso

Per ogni università contiamo i posti messi a bando, tenendo sempre separate le tre famiglie di posizioni: un assegno di ricerca e una cattedra non si sommano. Quando un bando non indica quanti posti offre, lo contiamo come uno, perché il numero vero è almeno quello; la pagina dice quanti bandi sono in questa situazione.

I posti vengono poi divisi per la dimensione dell'ateneo, cioè per i docenti e ricercatori in servizio, per gli studenti iscritti o, nel caso delle regioni, per i residenti. Il risultato è un tasso che permette di confrontare atenei grandi e piccoli. Una regione è semplicemente la somma delle sue università, così numeratore e denominatore riguardano sempre gli stessi atenei. Le università telematiche, che hanno studenti in tutta Italia, vengono confrontate con le altre ma non sono attribuite a nessuna regione.

Il periodo copre gli ultimi dodici mesi, ma non risale oltre l'inizio della raccolta: dei bandi pubblicati prima abbiamo visto soltanto quelli ancora aperti, e includerli favorirebbe chi lascia più tempo per candidarsi.

### Il confronto con la media nazionale

Sapere che un ateneo bandisce due posti ogni cento docenti dice poco, finché non lo si confronta con l'Italia nel suo insieme. Per questo calcoliamo quanti posti avrebbe bandito se seguisse il tasso nazionale, i posti *attesi*, e misuriamo di quanto quelli reali se ne discostano. La misura è uno z-score: la differenza tra posti osservati e attesi, divisa per la radice quadrata degli attesi.

### Perché la mappa è quasi tutta grigia

Con numeri piccoli le differenze nascono anche per caso: un ateneo può bandire molto in pochi mesi solo perché diversi contratti sono scaduti insieme. Per non scambiare il caso per un privilegio, la mappa colora una regione o un'università soltanto quando la differenza è troppo grande per essere spiegata dal caso. Tre accorgimenti rendono questa soglia prudente.

Il primo riguarda il modo in cui arrivano i posti: non uno alla volta, ma a gruppi, perché un solo bando di dottorato può aprirne trenta. I conteggi oscillano quindi più di quanto farebbero eventi indipendenti, e i margini vengono allargati di conseguenza, con il metodo proposto da David Spiegelhalter per confrontare le istituzioni (*Funnel plots for comparing institutional performance*, 2005).

Il secondo riguarda il numero dei confronti. Con cento università, qualcuna supererebbe per caso la soglia abituale del 95%: per questo chiamiamo «molto sopra» o «molto sotto» la media solo le differenze oltre il 99,8%, e semplicemente «sopra» o «sotto» quelle oltre il 95%.

Il terzo riguarda i casi con troppo pochi dati. Quando un ateneo avrebbe dovuto bandire meno di cinque posti, non lo giudichiamo affatto, e la mappa lo mostra con un contorno tratteggiato.

Gli intervalli al 95% delle tabelle seguono la stessa logica: sono calcolati con il metodo di Byar per i posti e con quello di Wilson per le quote di posizioni precarie, e allargati allo stesso modo.

### Le fonti

- **Bandi:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), raccolti ogni giorno da PostTheDoc e pubblicati anche come dataset aperto.
- **Docenti, ricercatori e studenti iscritti** per università: [USTAT](https://ustat.mur.gov.it), il portale statistico del MUR (licenza IODL 2.0). Contiamo professori ordinari e associati e ricercatori, a tempo indeterminato e determinato. Le scuole superiori, come la Normale o la SISSA, non hanno iscritti nei dati USTAT e restano fuori solo dal confronto per studente.
- **Residenti** per regione: ISTAT, tramite Eurostat (licenza CC BY 4.0).
- **Mappa:** confini regionali ISTAT da openpolis/geojson-italy (CC BY 4.0) e posizione delle città da OpenStreetMap (ODbL).

### Cosa questi dati non dicono

L'osservatorio vede solo i bandi pubblicati sul portale del MUR, che non raccoglie ogni bando di ogni ente. Soprattutto, non spiega le cause: un tasso alto può dipendere da pensionamenti, piani straordinari, progetti del PNRR o scelte dell'ateneo. È un punto di partenza per fare domande, non una conclusione.

Vale lo stesso per la finestra di candidatura. La data del bando è quella dell'atto, mentre la pubblicazione sul portale può arrivare qualche giorno dopo: la finestra reale per candidarsi può quindi essere più breve di quella indicata.
