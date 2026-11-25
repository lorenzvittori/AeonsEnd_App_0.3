// stylelint.config.mjs: il controllo dei colori nei CSS (npm run check). Fuori da src/stili/palette.css nessun colore
// scritto a mano: né esadecimale, né rgb()/rgba()/hsl()/hwb()/lab()/lch()/oklab()/oklch()/color(), né nome (red, white...).
// Restano permessi transparent, currentColor, inherit e color-mix() (che mescola ruoli, var(--...)).
// Eccezione: solo con un commento che spiega perché, nel CSS stesso, nella forma
//   /* stylelint-disable-next-line color-no-hex -- motivo */
// I colori dentro le immagini SVG in url("data:...") non sono CSS e il controllo non li vede.
// Dipende da: stylelint. Usato da: package.json (script check e colori).

export default {
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
  },
  // Un'eccezione senza motivo, o che non serve più, è un errore
  reportNeedlessDisables: true,
  reportDescriptionlessDisables: true,
  // La palette è il solo posto dove i colori si scrivono
  ignoreFiles: ['src/stili/palette.css'],
};
