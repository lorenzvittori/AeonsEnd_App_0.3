// tools/confronto/dati/scenari.mjs: impostazioni delle prove "scenari" e "salvataggi" (strumento di confronto,
// tools/confronto/README.md). Gli scenari sono quelli della Modalità test (app.SCENARI, letti dalla pagina: uno scenario
// nuovo entra da solo nella prova); i salvataggi sono i file di tools/confronto/salvataggi/.
export const PASSI_SCENARIO = 14;   // azioni giocate dopo l'avvio di ogni scenario
export const PASSI_SALVATAGGIO = 14; // azioni giocate dopo la ripresa di ogni salvataggio
export const SEME = 100;             // il passo n riparte dal caso SEME + n
