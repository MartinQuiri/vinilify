# Video promocional de Vinilify

Hecho con [Remotion](https://www.remotion.dev/). La interfaz está recreada en React (`src/components`) y el guion completo, cuadro a cuadro, está en `src/timeline.ts` y `src/Promo.tsx`.

```bash
npm install
node scripts/gen-sfx.mjs                                  # efectos de sonido (sintetizados)
../node_modules/electron/dist/electron.exe scripts/fetch-covers-spotify.js   # portadas (necesita la cuenta conectada en Vinilify)
python scripts/covers_extra.py                            # portadas propias + colores de acento
npm run studio                                            # vista previa
npm run render                                            # → out/vinilify-promo.mp4
```

## Créditos y derechos

- **Música:** «Gymnopedie No 1» — Kevin MacLeod ([incompetech.com](https://incompetech.com)), licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Hay que mantener este crédito donde se publique el video.
- **Letra:** «Cielito Lindo», Quirino Mendoza y Cortés (1882), dominio público.
- **Efectos de sonido:** sintetizados en `scripts/gen-sfx.mjs`, sin muestras de terceros.
- **Portadas:** © de sus respectivos artistas y sellos. Se usan solo como ejemplo de lo que muestra la app y no se incluyen en el repositorio (`public/covers/` está en `.gitignore`).
