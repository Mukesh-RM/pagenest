# Fonts

| File | Family | Size | License |
|---|---|---|---|
| `inter-latin-wght-normal.woff2` | Inter (controls, small text) | 28 kB | SIL OFL 1.1, `OFL-Inter.txt` |
| `literata-latin-wght-normal.woff2` | Literata (headings, titles, reading) | 34 kB | SIL OFL 1.1, `OFL-Literata.txt` |
| `literata-latin-wght-italic.woff2` | Literata italic | 35 kB | SIL OFL 1.1, `OFL-Literata.txt` |

Total 97 kB, down from 133 kB for Inter alone (two files) before. Preload only the two critical files, Inter and Literata
normal (`preload.ts`); the italic loads on demand.

## How they were made (reproducible, unmodified outlines)

Sources: `@fontsource-variable/inter` and `@fontsource-variable/literata` 5.x (`*-latin-wght-*.woff2`).
Neither OFL text declares a Reserved Font Name, so subsetting is allowed.

```sh
# 1. limit the weight axis to what the design uses (400, 600, 700)
python3 -c "from fontTools.ttLib import TTFont; from fontTools.varLib import instancer; \
f=instancer.instantiateVariableFont(TTFont('IN.woff2'),{'wght':(400,700)}); f.flavor=None; f.save('LIMITED.ttf')"
# 2. subset to Latin and common punctuation, keep kerning, ligatures and tabular numbers
pyftsubset LIMITED.ttf --flavor=woff2 --no-hinting --desubroutinize \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2010-2015,U+2018-201E,U+2020-2022,U+2026,U+2030,U+2032-2033,U+2039-203A,U+20AC,U+2122,U+2190-2193,U+2212,U+2215" \
  --layout-features='kern,liga,calt,ccmp,locl,mark,mkmk,tnum,case,frac,onum,lnum,pnum' --output-file=OUT.woff2
```

The latin-ext files (Inter 85 kB, Literata 43 kB) were dropped: the interface is English, and other scripts fall
back to the system font.
