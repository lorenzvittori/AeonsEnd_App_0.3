// ui/componenti/pulsante-principale.ts: zona 7 della schermata "partita": l'unico pulsante principale e "Annulla
// modifiche" accanto, disegnati dalle varianti del momento (variantePartita, ui/partita-variante.ts): testo, aspetto
// (colore del giocatore, illustrazione della nemesi, dorato per "Salva modifiche" e "Pesca", secondario per "Torna
// alla carta da risolvere") e l'azione (data-azione, che il coordinatore legge al tocco).
// Livello 3 (ui/componenti/). Dipende da: stato/ (partita, catalogo, preferenze: lettura), ui/ base (pagina,
// partita-variante). Usato da: navigazione (render), turno-nemesi-carosello.ts (carta mostrata cambiata).

import { awaitingTurnCard, currentTurnCard, isPairCard, turnCardPlayer } from '../../stato/partita.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { preferenze } from '../../stato/preferenze.ts';
import { annullaModificheBtn, cssUrl, pulsantePrincipale, ui } from '../pagina.ts';
import type { VariantePartita } from '../partita-variante.ts';

export function disegnaPulsantePrincipale(v: VariantePartita): void {
  const b = pulsantePrincipale;
  // Il colore del pulsante sfuma (transizione di .ae-button) solo dentro lo stesso gruppo: turno giocatori, turno nemesi
  // (risolvi e pesca), "Torna alla carta da risolvere". Passando da un gruppo all'altro cambia di colpo
  const gruppo = v.azione === 'torna' ? 'torna' : v.momento === 'nemesi' || v.momento === 'pesca' ? 'nemesi' : 'giocatori';
  const salto = b.dataset.gruppo !== undefined && b.dataset.gruppo !== gruppo;
  b.dataset.gruppo = gruppo;
  if (salto) b.style.transition = 'none';
  disegna(b, v);
  if (salto) {
    void b.offsetWidth;
    b.style.removeProperty('transition');
  }
}

function disegna(b: HTMLButtonElement, v: VariantePartita): void {
  b.dataset.azione = v.azione;
  b.textContent = v.testo;
  // "Torna alla carta da risolvere" (turno nemesi, si guarda un'altra carta) è un pulsante secondario
  const torna = v.azione === 'torna';
  b.classList.toggle('ae-button--primary', !torna);
  b.classList.toggle('ae-button--secondary', torna);
  // "Annulla modifiche" accanto, solo con modifiche non salvate
  annullaModificheBtn.hidden = !v.annullaModifiche;
  if (v.momento === 'giocatori' || v.momento === 'crea-mazzo') {
    // "Crea mazzo": al posto del pulsante il cursore
    b.hidden = v.azione === 'cursore';
    b.disabled = !catalogo.deckSetup;
    // Turno di un giocatore: niente illustrazione, fondo tenue del colore del giocatore (wild: il colore del giocatore
    // che è wild nel giro; carta 1/2 o 3/4 non ancora scelta: sfumatura dei due colori; attesa di "Pesca carta turno":
    // fondo grigio chiaro tenue, come il wild). Altrimenti l'illustrazione della nemesi della partita, velata
    const turnCard = currentTurnCard();
    const playerKind = turnCardPlayer(turnCard) || (turnCard === 'wild' || isPairCard(turnCard) ? turnCard : null)
      || (awaitingTurnCard() ? 'wild' : null);
    b.classList.toggle('has-player-color', !!playerKind);
    if (playerKind) b.dataset.kind = playerKind;
    else delete b.dataset.kind;
    const nemesisArtNow = !playerKind && preferenze.settings.nemesis ? catalogo.nemesisArt[preferenze.settings.nemesis] : undefined;
    b.classList.toggle('has-nemesis-art', !!nemesisArtNow);
    if (nemesisArtNow) b.style.setProperty('--ae-nemesis-art', cssUrl(encodeURI(String(nemesisArtNow.portrait))));
    else b.style.removeProperty('--ae-nemesis-art');
    b.setAttribute('aria-disabled', String(ui.isTransitioning));
    // "Salva modifiche": dorato
    b.classList.toggle('is-save', v.azione === 'salva-modifiche');
    b.classList.remove('is-draw');
    return;
  }
  // Turno nemesi e passo Pesca
  b.hidden = false;
  b.disabled = false;
  b.classList.remove('has-player-color', 'has-nemesis-art', 'is-save');
  delete b.dataset.kind;
  b.style.removeProperty('--ae-nemesis-art');
  // Passo Pesca: pulsante dorato, diverso da quelli della risoluzione
  b.classList.toggle('is-draw', v.azione === 'pesca');
  // Durante l'animazione il pulsante resta focalizzabile ma non accetta tocchi (aria-disabled, controllato in
  // onResolveClick); "Torna alla carta da risolvere" non aspetta
  if (torna) b.removeAttribute('aria-disabled');
  else b.setAttribute('aria-disabled', String(ui.isTransitioning));
}
