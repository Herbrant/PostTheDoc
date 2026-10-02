### Cosa si conta

- **I posti, non i bandi.** Un bando con tre posti conta tre. Il numero viene dal portale del MUR (dall'elenco o dalla pagina del bando). Quando il bando non lo indica, conta come un posto: il numero vero è almeno questo, e la pagina dice quanti bandi sono in questa situazione.
- **Tre gruppi, mai sommati tra loro:** carriera strutturata (ricercatori, professori, tecnologi), lavoro precario dopo la laurea (assegni, incarichi e contratti di ricerca, post-doc) e dottorato. Un assegno e una cattedra non sono la stessa cosa.
- **Il periodo:** gli ultimi dodici mesi per data del bando (la data in cui l'abbiamo trovato, se manca), e mai prima dell'inizio della raccolta: dei bandi precedenti abbiamo visto solo quelli ancora aperti, e contarli premierebbe chi lascia più tempo per candidarsi. I bandi ritirati prima della scadenza non contano.
- **Le università con un denominatore.** Enti di ricerca e AFAM non hanno un dato confrontabile e compaiono solo con i posti banditi. Le università telematiche sono confrontate tra le università ma non entrano nelle regioni: i loro studenti vengono da tutta Italia.

### Il tasso e il confronto

Per ogni università o regione: **tasso = posti ÷ denominatore**, ogni 100 docenti e ricercatori, ogni 1.000 studenti o ogni 100.000 residenti. Una regione è la somma delle sue università: numeratore e denominatore riguardano sempre le stesse università.

I **posti attesi** sono quelli che avrebbe con il tasso nazionale: denominatore × tasso nazionale. Il confronto tra posti osservati e attesi usa uno **z-score** (osservati − attesi) ÷ √attesi.

### Perché il grigio

Con numeri piccoli le differenze nascono anche per caso. Per non scambiare il caso per un privilegio:

- **Sovradispersione.** I posti non arrivano uno alla volta (un bando di dottorato può aprirne trenta), quindi variano più di eventi indipendenti. Seguendo Spiegelhalter (*Funnel plots for comparing institutional performance*, 2005), gli z-score vengono divisi per √φ, dove φ è la media dei loro quadrati dopo aver limitato il 10% più estremo per lato (se φ > 1).
- **Molti confronti.** Con cento università qualche differenza esce per caso: è "molto sopra/sotto" solo oltre il 99,8% (|z| ≥ 3,09), "sopra/sotto" oltre il 95% (|z| ≥ 1,96). Tutto il resto è **in linea**, in grigio.
- **Troppo pochi dati.** Sotto 5 posti attesi non si giudica.
- **L'intervallo al 95%** del tasso è quello di Byar per conteggi di Poisson, allargato di √φ.

La quota precaria segue lo stesso schema per le proporzioni (intervallo di Wilson).

### Le fonti

- **Bandi:** [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR, Cineca), raccolti ogni giorno da PostTheDoc. Il dataset completo è aperto.
- **Docenti e ricercatori** (professori ordinari e associati, ricercatori a tempo indeterminato e determinato) e **studenti iscritti** per università: [USTAT](https://ustat.mur.gov.it), MUR (licenza IODL 2.0). Le scuole superiori (Normale, Sant'Anna, SISSA...) non hanno iscritti in USTAT e non entrano nel confronto per studente.
- **Residenti** per regione: ISTAT, tramite Eurostat (CC BY 4.0).
- **Mappa:** confini ISTAT da openpolis/geojson-italy (CC BY 4.0); città da OpenStreetMap (ODbL).

### Cosa non dice

- **Non misura i fondi di ricerca.** Misura le posizioni bandite sul portale del MUR, che non raccoglie ogni bando di ogni ente.
- **Non spiega le cause.** Un tasso alto può dipendere da pensionamenti, piani straordinari, progetti PNRR o scelte dell'ateneo: è un punto di partenza per fare domande, non una conclusione.
- **La data del bando** è quella dell'atto: la pubblicazione sul portale può arrivare dopo, e la finestra reale per candidarsi essere più breve.
