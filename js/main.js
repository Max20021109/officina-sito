/* ==========================================================
   Autocar Service - interazioni
   GSAP + ScrollTrigger per le animazioni (mai window.scroll).
   Ogni animazione qui ha uno scopo dichiarato nel commento.
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- hero: video di sfondo ----------
     Video generico (componenti meccanici in CGI, non filmato in officina),
     servito come assets/video/hero.mp4. Se prefers-reduced-motion e' attivo
     evitiamo di forzare la riproduzione; per tutti gli altri casi (autoplay
     bloccato, rete lenta) non serve fare nulla: il video sotto lo scrim resta
     semplicemente trasparente e si vede lo sfondo statico (griglia + bagliore)
     che sta sempre dietro. */
  const heroVideo = document.querySelector('.hero__video');
  if (heroVideo) {
    if (reduceMotion) {
      heroVideo.removeAttribute('autoplay');
      heroVideo.pause();
    } else {
      heroVideo.play().catch(() => { /* autoplay bloccato: resta il poster/fallback */ });
    }
  }

  /* ---------- reveal a scorrimento (IntersectionObserver nativo) ----------
     Non dipende da GSAP: funziona anche se il CDN/i file di libreria non si
     caricano. Lo stato "nascosto" in CSS si attiva solo dopo reveal-ready,
     quindi in nessun caso una sezione resta invisibile per errore. */
  if ('IntersectionObserver' in window && !reduceMotion) {
    document.documentElement.classList.add('reveal-ready');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.will-reveal').forEach((el) => io.observe(el));
  }

  /* ---------- contachilometri (numero + arco + lancetta) ----------
     L'HTML parte gia' dallo stato finale (numero vero, arco pieno, lancetta a
     fondo scala): senza JS, con "riduci animazioni" o per Google si legge
     subito il dato giusto. Qui, solo se l'animazione puo' davvero partire, si
     riporta tutto a 0 e poi si anima insieme (numero, arco, lancetta) come una
     sgasata: la lancetta sale di colpo, torna un po' indietro, riaccelera fino
     a fondo scala e fa un piccolo rimbalzo prima di fermarsi (vedi SGASATA).
     Un quadrante dopo l'altro (STAGGER), quando la riga e' in vista.
     Arco e lancetta vanno sempre da 0 a fondo scala: e' un effetto visivo, non
     una statistica. L'arco ha pathLength="100", quindi il riempimento e' una
     percentuale; la lancetta ruota attorno al perno (50,56) del viewBox SVG. */
  const gauges = document.querySelectorAll('.gauge[data-count-to]');
  const stats = document.querySelector('.stats__inner');
  if (gauges.length && stats && !reduceMotion && 'IntersectionObserver' in window) {
    const setGauge = (el, fraction) => {
      const fill = el.querySelector('.gauge__fill');
      const needle = el.querySelector('.gauge__needle');
      if (fill) fill.style.strokeDashoffset = String(100 - 100 * Math.min(1, Math.max(0, fraction)));
      /* -120 = lancetta a sinistra (0), +120 = lancetta a destra (fondo scala) */
      if (needle) needle.setAttribute('transform', `rotate(${-120 + 240 * fraction} 50 56)`);
    };
    const setNum = (el, value) => {
      const numEl = el.querySelector('.gauge__num');
      if (numEl) numEl.textContent = value + (el.dataset.suffix || '');
    };

    /* azzera: da qui in poi si vede lo 0, e l'animazione lo riporta al valore */
    gauges.forEach((el) => { setGauge(el, 0); setNum(el, 0); });

    /* La "sgasata": tratti uno dopo l'altro, ognuno con [fine del tratto in
       frazione del tempo totale, posizione raggiunta (0 = zero, 1 = fondo
       scala), curva]. La lancetta puo' superare di poco il fondo scala nel
       rimbalzo (1.03); arco e numero invece si fermano al valore vero. */
    const inOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const out = (t) => 1 - Math.pow(1 - t, 3);
    const SGASATA = [
      [.30, .72, inOut],  /* accelera: su di colpo fin quasi a tre quarti */
      [.50, .38, inOut],  /* molla il gas: torna indietro */
      [.86, 1.03, inOut], /* riaccelera fino a fondo scala, un filo oltre */
      [1, 1, out],        /* rimbalzo: si assesta sul fondo scala */
    ];
    const DURATA = 2300;
    const posizione = (p) => {
      let t0 = 0, v0 = 0;
      for (const [t1, v1, curva] of SGASATA) {
        if (p <= t1) return v0 + (v1 - v0) * curva((p - t0) / (t1 - t0));
        t0 = t1; v0 = v1;
      }
      return 1;
    };

    const animateGauge = (el) => {
      const target = parseInt(el.dataset.countTo, 10);
      if (!Number.isFinite(target)) { setGauge(el, 1); return; }
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / DURATA, 1);
        const f = p < 1 ? posizione(p) : 1;
        setNum(el, Math.round(target * Math.min(1, f)));
        setGauge(el, f);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    /* Si osserva tutto il pannello (non il primo quadrante): su telefono, dove
       i quadranti sono 2x2, parte quando anche la seconda riga e' a schermo,
       cosi' nessuna lancetta finisce la corsa mentre e' ancora fuori vista. */
    const STAGGER = 260;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      gauges.forEach((el, i) => setTimeout(() => animateGauge(el), i * STAGGER));
    }, { threshold: .6 });
    io.observe(stats);
  }

  /* ---------- settori: accordion "il lavoro che ci rappresenta di piu'" ----------
     Animazione CSS pura (grid-template-rows 0fr -> 1fr in style.css): qui si
     tocca solo la classe .is-open e gli attributi aria, mai un'altezza calcolata
     in JS. Se il CSS non fosse supportato il pannello si aprirebbe comunque,
     solo senza la transizione morbida. */
  /* .faq__domanda (pagine settore): domande frequenti ad accordion */
  document.querySelectorAll('.faq__domanda').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrap = btn.nextElementSibling;
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (wrap) wrap.classList.toggle('is-open', !isOpen);
    });
  });

  /* ---------- mappa a due click: Google solo dopo il consenso (il click) ---------- */
  const mappa = document.getElementById('mappa');
  const mappaBtn = document.getElementById('mappaCarica');
  if (mappa && mappaBtn) {
    mappaBtn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.title = 'Mappa Google: come raggiungerci';
      f.src = 'https://www.google.com/maps?q=Autocar+Service%2C+Zona+Industriale+9%2C+11020+Saint-Marcel+AO&output=embed';
      f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade'; f.allowFullscreen = true;
      mappa.appendChild(f);
      mappa.classList.add('is-caricata');
    }, { once: true });
  }

  /* ---------- anno in footer ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- menu mobile ---------- */
  const burger = document.getElementById('navBurger');
  const mobileMenu = document.getElementById('navMobile');
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.setAttribute('aria-label', isOpen ? 'Chiudi il menu' : 'Apri il menu');
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- caroselli "lavori" e "recensioni": scorrono da soli, con calma ----------
     Un solo motore per tutti e due. Ogni carosello:
       - parte da solo SOLO quando e' davvero in vista (IntersectionObserver):
         mentre scorri la pagina lo trovi gia' in movimento, ma non consuma
         niente quando e' fuori schermo;
       - avanza di una card ogni tot secondi con scorrimento morbido, e a fine
         corsa torna all'inizio;
       - si ferma quando ci passi sopra col mouse, lo tocchi o ci entri col
         fuoco (tastiera), e riparte da solo quando lo lasci;
       - le frecce funzionano sempre e riazzerano il tempo;
       - con prefers-reduced-motion niente movimento automatico. */
  function carosello(trackId, prevId, nextId, cardSel, gap, ogniMs) {
    const track = document.getElementById(trackId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    if (!track) return;

    const distanza = () => {
      const card = track.querySelector(cardSel);
      return card ? card.getBoundingClientRect().width + gap : 300;
    };
    const vai = (dir) => track.scrollBy({ left: dir * distanza(), behavior: reduceMotion ? 'auto' : 'smooth' });

    let timer = null, inVista = false, fermo = false;
    /* barra sottile sotto il carosello: si riempie nel tempo che manca al prossimo scatto */
    const progresso = track.parentElement.querySelector('.carosello-progresso');
    const segna = () => {
      if (!progresso) return;
      progresso.classList.remove('va'); void progresso.offsetWidth; /* riavvia l'animazione */
      progresso.style.setProperty('--durata', ogniMs + 'ms'); progresso.classList.add('va');
    };
    const ferma = () => { if (timer) { clearInterval(timer); timer = null; } if (progresso) progresso.classList.remove('va'); };
    const parti = () => {
      if (reduceMotion || !inVista || fermo || timer) return;
      segna();
      timer = setInterval(() => {
        segna();
        const fine = track.scrollWidth - track.clientWidth - 4;
        if (track.scrollLeft >= fine) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          vai(1);
        }
      }, ogniMs);
    };
    const riparti = () => { ferma(); parti(); };

    if (prev) prev.addEventListener('click', () => { vai(-1); riparti(); });
    if (next) next.addEventListener('click', () => { vai(1); riparti(); });

    /* pausa quando l'utente ci mette le mani, riprende quando le toglie */
    const pausa = () => { fermo = true; ferma(); };
    const riprendi = (dopo) => { clearTimeout(track._resumeT); track._resumeT = setTimeout(() => { fermo = false; parti(); }, dopo || 0); };
    track.addEventListener('mouseenter', pausa);
    track.addEventListener('mouseleave', () => riprendi(600));
    track.addEventListener('touchstart', pausa, { passive: true });
    track.addEventListener('touchend', () => riprendi(3000), { passive: true });
    track.addEventListener('focusin', pausa);
    track.addEventListener('focusout', () => riprendi(600));

    /* si muove solo quando lo stai guardando */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((voci) => {
        inVista = voci.some((v) => v.isIntersecting);
        if (inVista) parti(); else ferma();
      }, { threshold: 0.35 }).observe(track);
    } else {
      inVista = true; parti();
    }
    /* scheda del browser in secondo piano: si ferma, cosi' non "salta" al ritorno */
    document.addEventListener('visibilitychange', () => { if (document.hidden) ferma(); else parti(); });
  }

  carosello('lavoriTrack', 'lavoriPrev', 'lavoriNext', '.carousel__slide', 19, 3600);

  /* ---------- recensioni: scorrono piano, in continuo, appena arrivi a vederle ----------
     Non a scatti come i lavori: un nastro che avanza da solo (circa 28 px al
     secondo), senza fine perche' le card sono duplicate una volta e quando la
     prima serie e' passata si torna indietro di nascosto della stessa misura.
     Si ferma sotto il mouse / il dito / il fuoco, riparte quando lo lasci; le
     frecce spostano di una card. Fuori dallo schermo non consuma niente. */
  (() => {
    const track = document.getElementById('recensioniTrack');
    const prev = document.getElementById('recensioniPrev');
    const next = document.getElementById('recensioniNext');
    if (!track) return;

    const originali = Array.from(track.children);
    originali.forEach((c) => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); k.classList.add('is-visible'); track.appendChild(k); });
    track.classList.add('scorre-da-sola');   /* toglie lo scroll-snap, che a scatti rovinerebbe il movimento */

    const meta = () => track.scrollWidth / 2;  /* larghezza della prima serie */
    const VEL = 28; /* px al secondo */
    let inVista = false, fermo = false, raf = null, prima = null, pos = 0;

    /* scrollLeft accetta solo interi: si tiene la posizione "vera" in una
       variabile con i decimali, se no a 28 px/s (mezzo pixel a fotogramma)
       l'arrotondamento la riporterebbe sempre a zero e non si muoverebbe. */
    const passo = (t) => {
      if (!inVista || fermo || reduceMotion) { raf = null; prima = null; return; }
      if (prima !== null) {
        pos += VEL * Math.min(0.05, (t - prima) / 1000);
        if (pos >= meta()) pos -= meta();
        track.scrollLeft = pos;
      }
      prima = t; raf = requestAnimationFrame(passo);
    };
    const parti = () => { pos = track.scrollLeft; if (!raf) raf = requestAnimationFrame(passo); };
    const ferma = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } prima = null; };

    const card = () => { const c = track.querySelector('.recensione-card'); return c ? c.getBoundingClientRect().width + 17.6 : 300; };
    const salta = (dir) => {
      fermo = true; ferma();
      track.scrollBy({ left: dir * card(), behavior: reduceMotion ? 'auto' : 'smooth' });
      clearTimeout(track._t); track._t = setTimeout(() => { fermo = false; parti(); }, 2500);
    };
    if (prev) prev.addEventListener('click', () => salta(-1));
    if (next) next.addEventListener('click', () => salta(1));

    const pausa = () => { fermo = true; ferma(); };
    const riprendi = (dopo) => { clearTimeout(track._t); track._t = setTimeout(() => { fermo = false; parti(); }, dopo); };
    track.addEventListener('mouseenter', pausa);
    track.addEventListener('mouseleave', () => riprendi(400));
    track.addEventListener('touchstart', pausa, { passive: true });
    track.addEventListener('touchend', () => riprendi(2500), { passive: true });
    track.addEventListener('focusin', pausa);
    track.addEventListener('focusout', () => riprendi(400));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((voci) => { inVista = voci.some((v) => v.isIntersecting); if (inVista) parti(); else ferma(); }, { threshold: 0.2 }).observe(track);
    } else { inVista = true; parti(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) ferma(); else parti(); });
  })();

  /* ---------- form di contatto: validazione + invio ---------- */
  const form = document.getElementById('contactForm');
  const statusEl = document.getElementById('formStatus');
  const submitBtn = document.getElementById('formSubmit');

  function setFieldError(name, message) {
    const field = form.querySelector(`[name="${name}"]`)?.closest('.form__field');
    const errorEl = form.querySelector(`[data-error-for="${name}"]`);
    if (errorEl) errorEl.textContent = message || '';
    if (field) field.classList.toggle('is-invalid', Boolean(message));
  }

  function validateForm() {
    let valid = true;
    const nome = form.nome.value.trim();
    const telefono = form.telefono.value.trim();
    const email = form.email.value.trim();
    const servizio = form.servizio.value;
    const privacy = form.privacy.checked;

    if (nome.length < 2) { setFieldError('nome', 'Inserisci nome e cognome.'); valid = false; }
    else setFieldError('nome', '');

    if (!/^[0-9+\s().-]{6,}$/.test(telefono)) { setFieldError('telefono', 'Inserisci un numero di telefono valido.'); valid = false; }
    else setFieldError('telefono', '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('email', 'Inserisci un indirizzo email valido.'); valid = false; }
    else setFieldError('email', '');

    if (!servizio) { setFieldError('servizio', 'Seleziona il tipo di servizio.'); valid = false; }
    else setFieldError('servizio', '');

    if (!privacy) { setFieldError('privacy', 'Devi accettare l\'informativa privacy per continuare.'); valid = false; }
    else setFieldError('privacy', '');

    return valid;
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.textContent = '';
      statusEl.className = 'form__status';

      if (!validateForm()) {
        statusEl.textContent = 'Controlla i campi evidenziati e riprova.';
        statusEl.classList.add('is-error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.style.opacity = '.7';
      statusEl.textContent = 'Invio in corso...';

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        if (!response.ok) throw new Error('Risposta del server non valida');

        form.reset();
        statusEl.textContent = 'Richiesta inviata. Ti ricontattiamo entro 24 ore lavorative.';
        statusEl.classList.add('is-success');
      } catch (err) {
        /* Se il form gira su un ambiente senza PHP attivo (es. aperto come file:// invece che tramite Laragon),
           offriamo un fallback via email diretta cosi' la richiesta non va persa. */
        const subject = encodeURIComponent('Richiesta preventivo dal sito');
        const body = encodeURIComponent(
          `Nome: ${form.nome.value}\nTelefono: ${form.telefono.value}\nEmail: ${form.email.value}\nServizio: ${form.servizio.value}\nMessaggio: ${form.messaggio.value}`
        );
        statusEl.innerHTML = `Non riesco a inviare automaticamente da qui. <a href="mailto:autocar-service@libero.it?subject=${subject}&body=${body}" style="color:var(--accent);text-decoration:underline">Apri la tua email per inviarci la richiesta</a>, oppure chiamaci.`;
        statusEl.classList.add('is-error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '';
      }
    });
  }

  /* ---------- WOW (24/09/2026): piccole cose che fanno sembrare il sito "vivo" ----------
     Tutto facoltativo e senza dipendenze: se una riga qui sotto fallisce, il
     resto della pagina non se ne accorge. */

  /* barra di avanzamento della lettura + testata che si compatta + "torna su" */
  (() => {
    const barra = document.createElement('div');
    barra.className = 'progresso-lettura'; barra.setAttribute('aria-hidden', 'true');
    document.body.appendChild(barra);

    const su = document.createElement('button');
    su.type = 'button'; su.className = 'torna-su'; su.setAttribute('aria-label', 'Torna in cima');
    su.innerHTML = '<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>';
    su.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
    document.body.appendChild(su);

    let ticking = false;
    const aggiorna = () => {
      ticking = false;
      const y = window.scrollY || document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      barra.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      document.documentElement.classList.toggle('e-scorso', y > 80);
      su.classList.toggle('visibile', y > window.innerHeight * 1.2);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(aggiorna); } }, { passive: true });
    aggiorna();
  })();

  /* voce del menu evidenziata in base alla sezione che si sta guardando */
  (() => {
    const links = Array.from(document.querySelectorAll('.nav__links a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    const perId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const sezioni = Array.from(perId.keys()).map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver((voci) => {
      voci.forEach((v) => {
        if (!v.isIntersecting) return;
        links.forEach((a) => a.classList.remove('is-attivo'));
        const a = perId.get(v.target.id); if (a) a.classList.add('is-attivo');
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
    sezioni.forEach((s) => io.observe(s));
  })();

  /* bordo luminoso che segue il mouse sulle card (solo con un mouse vero) */
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.offerta, .recensione-card, .stat');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    }, { passive: true });
  }

  /* i numeri del cruscotto fanno un piccolo "pop" quando arrivano a fondo scala */
  (() => {
    const nums = document.querySelectorAll('.gauge__num');
    if (!nums.length || !('MutationObserver' in window)) return;
    nums.forEach((n) => {
      const fine = n.closest('.gauge')?.dataset.countTo;
      const mo = new MutationObserver(() => {
        if (n.textContent.replace(/\D/g, '') === String(fine)) { n.classList.add('arrivato'); mo.disconnect(); }
      });
      mo.observe(n, { childList: true, characterData: true, subtree: true });
    });
  })();

  /* ---------- animazioni GSAP: solo il momento cinematografico dell'hero ----------
     Il reveal delle altre sezioni e' gestito sopra con IntersectionObserver, che non
     ha dipendenze esterne. GSAP qui e' un potenziamento facoltativo: se non si carica
     (rete assente, file bloccato) l'hero resta comunque leggibile e statico. */
  if (typeof gsap === 'undefined' || reduceMotion) return;
  gsap.registerPlugin(ScrollTrigger);

  /* Hero: l'etichetta piccola arriva per prima (annuncia il contesto), poi le due
     righe del titolo dal basso in sequenza, poi sottotitolo/CTA: storytelling di
     apertura pagina invece di un fade unico su tutto insieme. */
  gsap.set('.reveal-line > span', { yPercent: 110 });
  gsap.timeline({ delay: .15 })
    .from('.hero__eyebrow', {
      opacity: 0, y: 10, duration: .6, ease: 'power2.out',
    })
    .to('.reveal-line > span', {
      yPercent: 0,
      duration: 1,
      ease: 'power4.out',
      stagger: .12,
    }, '-=.35')
    .from('.hero__subtitle, .hero__cta', {
      opacity: 0, y: 16, duration: .7, ease: 'power2.out', stagger: .08,
    }, '-=.55');

  /* Hero: leggero parallax dello sfondo, driven da ScrollTrigger (mai window.scroll) */
  gsap.to('.hero__media', {
    yPercent: 14,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  /* Numeri della striscia stats: piccolo pop in sequenza per segnalare "questi sono i nostri numeri" */
  gsap.from('.stat', {
    opacity: 0, y: 14, duration: .6, stagger: .1, ease: 'power2.out',
    scrollTrigger: { trigger: '.stats', start: 'top 85%' },
  });

  /* Vetrina "preparazioni sportive": leggero effetto Ken Burns legato allo scroll
     (la foto parte leggermente ingrandita e si assesta man mano che la sezione
     entra in vista), per dare un momento piu' cinematografico prima del carosello. */
  gsap.fromTo('.showcase img',
    { scale: 1.18 },
    {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.showcase', start: 'top bottom', end: 'top top', scrub: true },
    }
  );

  /* Nota: le card della timeline e le righe dei settori NON usano piu' uno stagger
     GSAP legato al bordo superiore del contenitore. Su liste piu' lunghe di una
     schermata (es. 6 settori, o la timeline su mobile) quell'approccio le faceva
     arrivare tutte insieme non appena il contenitore iniziava a comparire, invece
     di una alla volta man mano che si scorre. Ora sono `.will-reveal` come le
     offerte/recensioni: ogni card/riga si anima quando ENTRA VERAMENTE in vista,
     con un piccolo transition-delay a cascata (vedi CSS) per quando piu' di una
     compare insieme su schermi larghi. */
});
