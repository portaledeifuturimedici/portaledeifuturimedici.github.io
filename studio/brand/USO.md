# Uso del marchio

> **Generato da `logo.py --kit`.** Non modificare i file a mano: cambia la fonte
> (`palette.py` per i colori, `BRAND` in `site_build.py` per il nome) e rigenera.
> I numeri qui sotto sono ricavati dalla geometria, non scelti a sentimento.

## Cosa c'è nel kit

| File | Quando si usa |
| --- | --- |
| `marchio.svg` | il segno da solo, col suo riquadro. L'uso normale. |
| `marchio-senza-fondo.svg` | quando il fondo lo metti tu (e non è scuro). |
| `favicon.svg` | scheda del browser e ogni uso sotto i 48 px. |
| `marchio-mono-chiaro.svg` | una tinta sola, su fondo scuro. |
| `marchio-mono-scuro.svg` | una tinta sola, su fondo chiaro. |
| `lockup-orizzontale.svg` | marchio + nome. **La forma da usare quasi sempre** fuori dal sito. |
| `lockup-orizzontale-chiaro.svg` | lo stesso, per fondi chiari. |
| `lockup-verticale.svg` | quando lo spazio è stretto e alto. |
| `lockup-mono-*.svg` | lockup a una tinta sola. |

## Le due rese, e perché

Il marchio ha **due rese**, e la scelta non è estetica ma misurata:

- **sopra i 48 px** — sagoma scura con il contorno neon, come il
  model-sheet del Cerbero;
- **sotto i 48 px** — le tre teste piene del colore-firma.

Motivo: la sagoma scura sul fondo notte fa **1,12:1** di contrasto (invisibile) e
il contorno scende **sotto il pixel già a 32 px**. La resa piena tiene la stessa
sagoma e la stessa identità, ma si vede. `logo.svg(dim=…)` sceglie da sola.

## Regole

**Dimensione minima:** 24 px per il marchio da solo,
150 px di larghezza per il lockup. Sotto, le punte delle orecchie
non si separano più e il nome non si legge.

**Area di rispetto:** attorno al marchio lascia almeno il **9.4%**
della sua larghezza — è già dentro `marchio.svg`, ma se lo ritagli, ridalla.

**I colori vengono dalla palette**, sempre: #2BE0E0 · #FFB23E · #C04BFF. Sono i colori-firma del
trio (Pocho, Diego, Ciro) e cambiano se cambia `palette.py` — il kit si rigenera,
non si ritocca. Sono anche i più distinguibili: **45,6 dE00** in visione tipica e
**23,5** in deuteranopia.

**Non fare:** non ricolorare le teste una per una, non ruotare il segno, non
separare le tre teste, non stirare in modo non proporzionale, non aggiungere
ombre o contorni, non mettere il marchio su un fondo che non stacca (serve
almeno 3:1 col colore delle teste).

## Il limite da conoscere

**Nei lockup il nome è TESTO, non tracciati.** Rende con i caratteri di sistema,
quindi cambia leggermente da una macchina all'altra — ed è il motivo per cui il
riquadro ha un margine destro un po' abbondante: tarato stretto, altrove
taglierebbe.

Per la **stampa** e per i prodotti serve convertire il testo in tracciati, o
scegliere un carattere di marca e incorporarlo. È una decisione aperta: qui non
c'è un motore di font per farlo, e scegliere il carattere è una scelta di brand.

_Nome attuale: **Portale dei Futuri Medici ** — si cambia da `BRAND` in `site_build.py`._
