# Styles de rendu

Réglage « Style » de la vue Personnaliser, persisté comme la forme et la couleur
(`bloub:style`, `bloub:pixel`). Quatre choix : **Original** (par défaut, inchangé),
**Pixel art**, **3D argile**, **3D bulle**.

Le moteur ne change pas : `engine.sample(t)` rend la même image et les 14 états, leurs
mesures et leurs durées sont identiques. Seul `BloubBot.vue` peint l'image autrement.
Le catalogue et le réglage courant vivent dans `src/ui/rendu.ts`.

## Pixel art (`src/ui/pixel.ts`)

Chaque image du moteur est rasterisée sur une petite grille (boule de 16, 24 ou 32 pixels,
réglage « Taille des pixels »), puis chaque case reçoit une couleur :

- corps : la couleur choisie en deux tons plus un reflet (ombre en bas à droite, clair en
  haut à gauche) ;
- yeux : le papier, comme l'original ;
- contour sombre d'un pixel autour du corps et des points de sa couleur ;
- anneaux, particules colorées, pastille : ramenés à la palette PICO-8 (16 couleurs).

Le morphing reste fluide parce que l'image est re-pixellisée à chaque frame. Le résultat
est un SVG ordinaire (`<path>` en `crispEdges`), donc PNG, SVG, GIF et MP4 marchent sans
code à part. L'animation SVG exportée est un feuilletage (`svgFeuilletage`, `anime.ts`),
les images identiques consécutives fusionnées. Sans canvas (tests `node`, `happy-dom`),
le composant retombe sur l'original.

## 3D douce

Tout est dans le SVG : dégradé radial (lumière en haut à gauche), reflet flou, ombre
portée colorée et floue, ombre interne légère, et le corps percé décalé et flou derrière
les trous pour donner un peu de creux aux yeux. Le masque des yeux reste le seul et le
premier du document, ses seules formes à matrice sont les yeux : l'export SVG animé
continue de fonctionner tel quel.

- **argile** (icônes 3D d'Airbnb) : couleur passée au pastel, reflet large et doux,
  ombre interne plus marquée, mat ;
- **bulle** (le « dot » d'OpenAI) : couleur saturée, reflet net, lumière renvoyée en bas.

## Limites connues

- Les GIF en 3D pèsent lourd (environ 800 ko pour 3 s) : les dégradés font beaucoup de
  couleurs, le GIF en garde 256.
- Le reflet et le dégradé 3D sont fixes dans l'espace : sur un état où le corps se déplace
  ou se réduit (veille, comète), la lumière ne le suit pas exactement.
- En pixel art, les petites particules (éclatement) font moins d'une case et disparaissent
  en partie ; les yeux à 16 pixels sont de simples traits.

Captures : `docs/variantes/` (planche des 14 états par style, gros plans, écran
Personnaliser).
