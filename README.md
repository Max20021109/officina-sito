# Sito Autocar Service

Sito statico (HTML/CSS/JS) per un'officina meccanica, con un piccolo modulo PHP per il form di contatto. Pensato per girare su Laragon (Apache + PHP), ma essendo statico funziona su qualunque hosting che supporti PHP.

## Come aprirlo

Il sito e' gia' in `C:\laragon\www\officina`. Con Laragon avviato:

- Auto Virtual Host: `http://officina.test/`
- In alternativa: `http://localhost/officina/`

Aprendo `index.html` direttamente come file (doppio click, `file://...`) il sito si vede lo stesso, ma il form di contatto non funziona: serve un server PHP attivo (quindi Laragon), perche' il form manda i dati a `php/contattaci.php`.

## Struttura del progetto

```
officina/
  index.html              home page (tutte le sezioni sono ancore: #storia, #servizi, ...)
  storia.html             pagina "Chi siamo" a se stante: la timeline completa dei 40 anni, per non appesantire la home. La home mostra solo un riassunto con un bottone "Scopri la storia completa" che porta qui.
  lavori.html             tutti i lavori svolti, con i filtri per settore (JS, senza ricaricare). Ci porta il link "Vedi tutti i lavori" sotto il carosello della home.
  settore-*.html          una pagina per settore (preparazioni-sportive, officina-meccanica, gommista, elettrauto, tuning-montaggio, scarichi), tutte con la stessa struttura. Ci portano i link dentro l'accordion dei settori in home, le card di lavori.html e il footer.
  css/style.css            tutto lo stile (tema chiaro di base; hero, vetrina "lavori" e footer restano scuri via variabili CSS scoped su quelle sezioni)
  js/main.js               menu mobile, carosello, validazione form, animazioni
  php/contattaci.php        riceve il form e prova a inviare l'email
  php/richieste.log         (creato automaticamente) registro di riserva delle richieste
  assets/vendor/            librerie auto-ospitate: GSAP, Font Awesome, i font (Rajdhani, Manrope, JetBrains Mono)
  assets/img/                foto (quelle reali vanno qui) + hero-poster.jpg (fotogramma statico del video hero)
  assets/video/               hero.mp4: video generico di sfondo dell'hero (componenti meccanici in CGI, non girato in officina), da sostituire con un video vero appena disponibile
  scripts/render_hero_video.py  script di riserva per generare un loop animato al posto del video: non e' piu' quello in uso, serve solo come alternativa se non si vuole un video vero (richiede Python + ffmpeg, non serve per far girare il sito)
  robots.txt / sitemap.xml   file tecnici per Google
  BRIEF-CLIENTE.md            domande da fare al cliente per avere tutti i contenuti
```

Le librerie in `assets/vendor/` sono scaricate una volta sola e servite dal sito stesso: niente Google Fonts o CDN esterni da caricare ogni volta, il sito e' piu' veloce e funziona anche se la connessione e' scarsa.

## Cosa sostituire prima di pubblicare

**Pagine template (storia, lavori, settori):** testi e foto sono finti, messi solo per vedere il layout pieno. Ogni blocco da riempire e' segnato nel codice con `<!-- DA SOSTITUIRE -->` (Ctrl+F): foto Picsum o blocchi grigi "Foto da sostituire", anni della timeline, persone dello staff, casi "il lavoro che ci rappresenta di piu'", gallerie, domande frequenti, e le 12 card di lavori.html (per aggiungerne una basta copiare un `<li>` e cambiare `data-settore`). Tutte le pagine usano lo stesso `css/style.css` e `js/main.js` della home.

I dati base (nome, indirizzo, telefono, WhatsApp, email, P.IVA, logo, servizi) sono gia' quelli reali di Autocar Service. Restano da sostituire, dentro `index.html` (Ctrl+F nel tuo editor):

- I quattro passaggi della sezione "Chi siamo" (`[19XX]`, `[20XX]`, i testi tra parentesi, dentro `storia.html`): mancano ancora i dettagli veri della storia dell'officina.
- Le sei descrizioni "Il lavoro che ci rappresenta di piu'" nella sezione Settori (accordion che si apre sulla freccia): oggi sono segnaposto tra parentesi quadre, vanno sostituite con un caso vero per settore (vedi BRIEF-CLIENTE.md, punto 3).
- I prezzi in "Offerte del mese", che oggi sono solo esempi, e la data di validita' (`[30/XX/2026]`).
- `[LINK ALLA SCHEDA GOOGLE BUSINESS]`: link vero alla scheda Google, per il pulsante recensioni e per allineare la mappa.
- Le foto segnaposto (foto stock generiche, non fasulle: solo non sono le vostre) nella sezione "Chi siamo", nella vetrina "preparazioni sportive" e nel carosello lavori: da sostituire con foto vere dell'officina appena arrivano (vedi BRIEF-CLIENTE.md, punto 5).
- Il video di sfondo nell'hero (`assets/video/hero.mp4`): oggi e' una clip generica (componenti meccanici in CGI, non girata in officina), non un video vero di Autocar Service. Quando arriva un filmato reale dell'officina (bastano pochi secondi girati col telefono), basta convertirlo in mp4 e sostituire quel file (e rifare `hero-poster.jpg` con un fotogramma del nuovo video): il resto della pagina non cambia.
- `tuodominio.it` (canonical, og:url, JSON-LD, sitemap, robots.txt): finche' non e' stato scelto e registrato un dominio vero.

Usa **BRIEF-CLIENTE.md** come lista di domande da girare al cliente: segna cosa e' gia' confermato (dati, servizi, logo) e cosa manca ancora (storia, prezzi, foto, video, recensioni, dominio).

Le foto sono placeholder da Picsum (immagini a caso, solo per vedere il layout pieno): vanno sostituite con foto vere dell'officina. Basta cambiare l'attributo `src` delle immagini in `index.html` con il percorso della foto reale (consiglio: mettile in `assets/img/` e punta li').

## Il modulo di contatto (PHP)

`php/contattaci.php` valida i dati, salva ogni richiesta in `php/richieste.log` (cosi' nessuna si perde) e prova a inviare un'email con `mail()`.

**Attenzione, importante:** su Windows/Laragon in locale, `mail()` di norma **non invia nulla** perche' Windows non ha un programma di invio posta integrato. Per farlo funzionare hai due strade:

1. **In locale (solo per test):** configura in `php.ini` un server SMTP vero (es. un account Gmail con password per le app) nella sezione `[mail function]`.
2. **In produzione, su un hosting vero:** nella maggior parte dei casi `mail()` funziona gia' cosi' com'e'. Se il tuo hosting lo sconsiglia o non arriva nulla, la soluzione piu' solida e' sostituire `mail()` con **PHPMailer** configurato con le credenziali SMTP del provider email dell'officina: e' un cambiamento piccolo e isolato dentro `contattaci.php`, tutto il resto del sito resta uguale.

Finche' l'invio email non e' configurato, ogni richiesta resta comunque salvata in `php/richieste.log`: apri quel file ogni tanto per non perdere contatti. Il sito, lato utente, in caso di mancato invio propone comunque di scrivere una email diretta, cosi' la richiesta non va persa.

Cambia l'indirizzo di destinazione modificando la costante `EMAIL_DESTINATARIO` in cima a `contattaci.php`.

## Indicizzazione e vecchio sito

Il sito include gia' `robots.txt` e `sitemap.xml` (da aggiornare con il dominio vero). Per la parte che riguarda il **vecchio sito da rimuovere dall'indicizzazione di Google**, sono passaggi che vanno fatti sul vecchio dominio/hosting, non nei file di questo progetto:

1. Verifica il possesso del dominio su [Google Search Console](https://search.google.com/search-console).
2. Se il vecchio sito resta online, imposta un redirect 301 da ogni pagina vecchia alla nuova home (evita di perdere il posizionamento gia' costruito).
3. Se il vecchio sito viene proprio spento, invece del redirect puoi chiedere a Google la rimozione delle vecchie pagine dallo strumento "Rimozioni" di Search Console.
4. Quando il nuovo sito e' online sul dominio definitivo, invia la nuova `sitemap.xml` da Search Console cosi' Google la trova subito, invece di aspettare la scansione naturale.

## Prossimi passi consigliati

1. Raccogliere le risposte di `BRIEF-CLIENTE.md`.
2. Sostituire i segnaposto in `index.html` (testi, contatti, prezzi).
3. Sostituire le foto placeholder con foto vere.
4. Decidere se/quando sostituire il video generico dell'hero con un filmato vero girato in officina.
5. Configurare l'invio email del form (vedi sopra).
6. Registrare il dominio definitivo e aggiornare `robots.txt`, `sitemap.xml` e i tag `og:` in `index.html` con l'URL vero.
