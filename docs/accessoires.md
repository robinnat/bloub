# Accessoires de métier (couche facultative)

`src/bot/accessoires.ts` pose devant un avatar AU TRAVAIL un petit objet animé, dessiné en
code dans le style 3D argile mat (dégradés doux, ombre portée floue, aucun reflet brillant),
et le geste qui va avec : l'avatar rapetisse un peu, se range en haut à gauche et regarde son
objet en bas à droite.

```ts
import { BotEngine } from './engine'
import { accessoireDuMetier } from './accessoires'

const a = accessoireDuMetier('redaction')            // carnet et crayon
const image = bot.sample(t, a.geste(t))
const svg = rendu(image) + a.dessin(t, { uid: 'b1-', corps: teintes3d(couleur, 'argile'), papier: '#f5f5f7' })
```

`dessin(t, options)` rend du SVG en texte dans le repère du moteur (rayon 100, origine au
centre, viewBox de -158 à 158), à poser PAR-DESSUS le corps. Pur, fonction du temps ;
chaque boucle se raccorde sans couture (testé). `uid` préfixe tous les identifiants SVG.
`simple: true` retire les détails fins (mains, rayures, sillage) pour les très petites tailles.
Pour le mouvement réduit, l'application dessine une seule image fixe.

![Accessoires, trois moments par métier, puis 64 et 36 px](accessoires.png)

| Métier | Accessoire | Mouvement |
|---|---|---|
| rédaction, guides | `carnet` | les lignes s'écrivent une à une, le crayon suit la fin de la ligne |
| code, dashboard, scripts | `portable` | lignes de code colorées qui défilent, les deux mains tapent |
| vidéo | `clap` | le clap s'ouvre et claque, petit éclat, l'avatar hoche la tête |
| analyse | `graphique` | les barres montent, une loupe passe dessus |
| publication | `avion` | un avion en papier part en courbe puis revient, le regard le suit |
| DA | `palette` | le pinceau pose une touche sur la toile, une couleur par passage |
| chef | `presse-papiers` | la liste se coche ligne par ligne |
| recherche, SEO, sourcing, QA, vérification | `liste` | une loupe descend la liste, chaque ligne lue se coche |
| autre | `engrenage` | deux engrenages tournent |

## Mains

Deux capsules détachées de la couleur du corps (0,34 x 0,15 rayon) tiennent l'outil. L'idée et
les proportions viennent des mains détachées proposées dans la PR 20 du dépôt d'origine
jeremy-prt/bloub (Efrain Chiri Nina, licence MIT) ; elles sont réécrites ici dans la couche
d'accessoires, pure et sans Vue, au lieu d'un composant.
