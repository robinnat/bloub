/**
 * Accessoires de metier : un petit objet anime pose devant l'avatar AU TRAVAIL (carnet et
 * crayon, ordinateur portable, clap, graphique et loupe, avion en papier, palette, presse-papiers,
 * liste et loupe, engrenage), avec le geste qui va avec (il se penche et regarde son objet).
 *
 * Comme les gestes (`gestes.ts`), ce sont des REGLAGES choisis, pas des mesures, et une couche
 * facultative : rien ne change dans `engine.sample(t)` tant qu'on ne s'en sert pas.
 *
 *   const a = ACCESSOIRE_BY_ID.get('carnet')!
 *   const image = bot.sample(t, a.geste(t))           // l'avatar regarde son carnet
 *   svg = rendu(image) + a.dessin(t, { uid, corps, papier })   // l'objet, devant le corps
 *
 * `dessin` rend du SVG en texte, dans le repere du moteur (rayon 100, origine au centre de la
 * boule, viewBox de -158 a 158). Tout est pur, fonction du temps : meme image a chaque lecture.
 * Style 3D argile mat : degrades doux, liseres clairs discrets, ombre portee floue ; aucun
 * reflet brillant. `simple: true` retire les details fins pour les tres petites tailles.
 *
 * Les mains (deux capsules de la couleur du corps, detachees, qui tiennent l'outil) reprennent
 * l'idee et les proportions des mains detachees proposees dans la PR 20 du depot d'origine
 * jeremy-prt/bloub (Efrain Chiri Nina, MIT) ; le code est ecrit ici, pas copie.
 */
import { TAU, clamp, easings, lerp } from './math'
import { GESTE_NEUTRE, type Geste } from './gestes'

export type AccessoireId =
  | 'carnet'
  | 'portable'
  | 'clap'
  | 'graphique'
  | 'avion'
  | 'palette'
  | 'presse-papiers'
  | 'liste'
  | 'engrenage'

/** Teintes du corps (celles de `teintes3d`), pour les mains. */
export interface TeintesCorps {
  clair: string
  base: string
  ombre: string
}

export interface DessinOptions {
  /** prefixe unique des identifiants SVG (degrades, decoupes) de cet avatar */
  uid: string
  corps: TeintesCorps
  /** couleur du fond sous l'avatar */
  papier: string
  /** tres petite taille : moins de lignes, traits plus epais, pas de mains */
  simple?: boolean
}

export interface GesteOptions {
  /**
   * echelle du corps sous accessoire (1 par defaut = taille de repos). Sous 1, le corps rapetisse
   * et se range en haut a gauche pour laisser plus de place a l'objet.
   */
  echelleCorps?: number
}

export interface Accessoire {
  id: AccessoireId
  /** duree de la boucle, en secondes */
  boucle: number
  /**
   * geste de l'avatar qui travaille avec l'objet (il le regarde). Par defaut le corps garde
   * EXACTEMENT sa taille et sa place de repos (`echelleCorps` 1) : c'est l'objet qui s'adapte.
   */
  geste: (t: number, o?: GesteOptions) => Geste
  /** l'objet, en SVG texte, a dessiner PAR-DESSUS le corps */
  dessin: (t: number, o: DessinOptions) => string
}

// ---------------------------------------------------------------- outils de dessin

const n = (v: number) => String(Math.round(v * 10) / 10)
const mod = (t: number, p: number) => ((t % p) + p) % p
const cloche = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2)
const g = (p: Partial<Geste>): Geste => ({ ...GESTE_NEUTRE, ...p })

/** Couleurs des objets : chaudes, peu saturees, mates. */
export const TEINTES_OBJETS = {
  papier: '#f8f3ea',
  papierOmbre: '#e3d8c6',
  tranche: '#cdbfa8',
  trait: '#8b8f9a',
  ardoise: '#3f4652',
  ardoiseClair: '#566070',
  gris: '#c9c4bc',
  grisOmbre: '#a39e96',
  ecran: '#2f3a46',
  bois: '#c9a27a',
  boisOmbre: '#a8825c',
  crayon: '#f0c36a',
  gomme: '#e8a3a3',
  vert: '#6fbf86',
  couleurs: ['#8fd3a2', '#f2b880', '#9fb8e8', '#e8a0a8', '#f2d27a']
} as const
const O = TEINTES_OBJETS

const lin = (id: string, c0: string, c1: string, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`

/** Definitions communes : flou de l'ombre portee, degrade des mains. */
const defsCommunes = (o: DessinOptions) =>
  `<filter id="${o.uid}af" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>` +
  lin(`${o.uid}am`, o.corps.clair, o.corps.ombre)

/** Ombre portee douce sous un objet. */
const ombre = (o: DessinOptions, x: number, y: number, rx: number, ry = rx * 0.22) =>
  `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="#000" opacity="0.14" filter="url(#${o.uid}af)"/>`

/** Une main detachee : capsule de la couleur du corps (0,39 x 0,15 rayon). */
const main = (o: DessinOptions, x: number, y: number, rot: number) =>
  o.simple
    ? ''
    : `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)})"><rect x="-17" y="-7.5" width="34" height="15" rx="7.5" fill="url(#${o.uid}am)"/>` +
      `<path d="M-11 -6.2h22" stroke="#fff" stroke-opacity="0.35" stroke-width="1.6" stroke-linecap="round"/></g>`

/** Trait revele progressivement (0 -> 1). */
const trait = (d: string, long: number, f: number, couleur: string, epaisseur: number) =>
  f <= 0
    ? ''
    : `<path d="${d}" fill="none" stroke="${couleur}" stroke-width="${n(epaisseur)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${n(long)} ${n(long + 10)}" stroke-dashoffset="${n(long * (1 - clamp(f)))}"/>`

/** Coche (de -1 a 1 en largeur). */
const coche = (x: number, y: number, k: number, f: number, epaisseur: number) =>
  trait(`M${n(x - 4 * k)} ${n(y)}l${n(3 * k)} ${n(3 * k)}l${n(6 * k)} ${n(-7 * k)}`, 14 * k, f, O.vert, epaisseur)

/**
 * Regard vers l'objet, en bas a droite. Le corps ne bouge pas (taille et place de repos) :
 * `yaw`, `pitch`, `roll` sont des visees (degres, renforcees pour se lire en petit) ; `dx`, `dy`,
 * `sx`, `sy` ne portent que le petit mouvement du metier (frappe, hochement).
 */
const versObjet = (p: Partial<Geste> = {}) =>
  g({ ...p, yaw: 1.15 * (p.yaw ?? 18), pitch: 1.3 * (p.pitch ?? 14), roll: p.roll ?? 3 })

/** Reduction facultative du corps (`echelleCorps` < 1) : il rapetisse et se range en haut a gauche. */
const avecEchelle = (geste: Geste, o?: GesteOptions): Geste => {
  const e = clamp(o?.echelleCorps ?? 1, 0.5, 1)
  if (e === 1) return geste
  return { ...geste, sx: geste.sx * e, sy: geste.sy * e, dx: geste.dx - 1.25 * (1 - e), dy: geste.dy - 0.8 * (1 - e) }
}

/**
 * Place des objets : dessines autour de (100, 105), poses DEVANT l'avatar en bas a droite, hors
 * du visage (rien de sombre sous les yeux), en leger chevauchement avec le bas du corps et en
 * debordant un peu du cadre (le client laisse le SVG deborder : `overflow: visible`).
 */
const PLACE = 'translate(-8 -12) scale(1.3)'

/** Loupe : anneau mat, verre teinte tres leger, manche. */
const loupe = (o: DessinOptions, x: number, y: number, r: number) =>
  `<g transform="translate(${n(x)} ${n(y)})">` +
  `<rect x="${n(r * 0.55)}" y="${n(r * 0.55)}" width="${n(r * 1.25)}" height="${n(r * 0.48)}" rx="${n(r * 0.24)}" transform="rotate(45 ${n(r * 0.55)} ${n(r * 0.55)})" fill="url(#${o.uid}lm)"/>` +
  `<circle r="${n(r)}" fill="#dfe8f2" fill-opacity="0.45" stroke="url(#${o.uid}la)" stroke-width="${n(r * 0.32)}"/>` +
  `</g>`
const defsLoupe = (o: DessinOptions) => lin(`${o.uid}la`, '#8d939c', '#5d636c') + lin(`${o.uid}lm`, O.bois, O.boisOmbre)

/** Feuille posee en 3/4 (repere local : x de -w/2 a w/2, y de -h/2 a h/2). */
const feuille = (o: DessinOptions, w: number, h: number) =>
  `<rect x="${n(-w / 2 + 2)}" y="${n(-h / 2 + 4)}" width="${n(w)}" height="${n(h)}" rx="8" fill="${O.tranche}"/>` +
  `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="8" fill="url(#${o.uid}fp)"/>` +
  `<path d="M${n(-w / 2 + 8)} ${n(-h / 2 + 1.2)}h${n(w - 16)}" stroke="#fff" stroke-opacity="0.7" stroke-width="1.6" stroke-linecap="round"/>`
const defsFeuille = (o: DessinOptions) => lin(`${o.uid}fp`, O.papier, O.papierOmbre, 1, 1)

const enveloppe = (o: DessinOptions, contenu: string, defs = '') =>
  `<g class="bloub-accessoire" transform="${PLACE}"><defs>${defsCommunes(o)}${defs}</defs>${contenu}</g>`

// ---------------------------------------------------------------- les accessoires

/** Redaction : un carnet, des lignes qui s'ecrivent une a une, le crayon suit la fin de la ligne. */
const carnet: Accessoire = {
  id: 'carnet',
  boucle: 4.8,
  geste: (t) => {
    const u = mod(t, 4.8)
    const ligne = Math.min(3, Math.floor(u / 0.9))
    return versObjet({ pitch: 15 + ligne * 2, dy: 0.012 * Math.sin((t / 0.48) * TAU), roll: 3 + 2 * Math.sin((t / 0.96) * TAU) })
  },
  dessin: (t, o) => {
    const u = mod(t, 4.8)
    const nb = o.simple ? 3 : 4
    const pas = 3.6 / nb
    const ys = o.simple ? [-14, 0, 14] : [-16, -4, 8, 20]
    const fin = (k: number) => (k === nb - 1 ? 14 : 30)
    const fondu = 1 - clamp((u - 4.4) / 0.4)
    let lignes = ''
    let px = -30
    let py = ys[0]!
    for (let k = 0; k < nb; k++) {
      const f = clamp((u - k * pas) / pas)
      const long = fin(k) + 30
      lignes += trait(`M-30 ${ys[k]}H${fin(k)}`, long, f, O.trait, o.simple ? 6 : 3.6)
      if (u >= k * pas) {
        px = -30 + long * f
        py = ys[k]!
      }
    }
    const tremble = u < 3.6 ? 1.4 * Math.sin((t / 0.08) * TAU) : 0
    const crayon =
      `<g transform="translate(${n(px)} ${n(py - 2 + tremble)}) rotate(-52)">` +
      `<path d="M0 0l7 -4.5h0v9z" fill="#e9d7b4"/><path d="M0 0l2.6 -1.7v3.4z" fill="#4a4f5a"/>` +
      `<rect x="7" y="-4.5" width="38" height="9" rx="2.5" fill="url(#${o.uid}cr)"/>` +
      `<rect x="43" y="-4.5" width="8" height="9" rx="3.5" fill="${O.gomme}"/></g>`
    return enveloppe(
      o,
      ombre(o, 100, 140, 52) +
        `<g transform="translate(98 106) rotate(-9) skewX(-10)">${feuille(o, 84, 62)}<g opacity="${n(fondu)}">${lignes}</g>` +
        (o.simple ? '' : crayon) +
        `</g>` +
        main(o, 112 + px * 0.9, 128 + py * 0.5, -40),
      defsFeuille(o) + lin(`${o.uid}cr`, O.crayon, '#d9a64e')
    )
  }
}

/** Code : un portable de 3/4, des lignes de code colorees qui defilent, les mains tapent. */
const portable: Accessoire = {
  id: 'portable',
  boucle: 6.4,
  geste: (t) => {
    const tap = Math.max(0, Math.sin((t / 0.2) * TAU)) * (0.6 + 0.4 * Math.sin((t / 1.6) * TAU) ** 2)
    return versObjet({ pitch: 12, dy: 0.025 * tap, sx: 1 + 0.012 * tap, sy: 1 - 0.025 * tap })
  },
  dessin: (t, o) => {
    // une boucle fait defiler exactement `parBoucle` lignes, qui reviennent ensuite a l'identique
    const pasLigne = o.simple ? 11 : 7
    const parBoucle = o.simple ? 5 : 8
    const vitesse = (pasLigne * parBoucle) / 6.4
    const decal = mod(t * vitesse, pasLigne)
    const premiere = Math.floor((t * vitesse) / pasLigne)
    let code = ''
    for (let i = 0; i < 8; i++) {
      const y = 50 - decal - i * pasLigne
      if (y < 2 || y > 54) continue
      const k = mod(premiere + i, parBoucle)
      const h = Math.imul(k + 7, 2654435761) >>> 0
      const retrait = o.simple ? 0 : [0, 6, 12, 6][h % 4]!
      const l1 = 10 + (h >> 4) % 22
      const l2 = o.simple ? 0 : (h >> 9) % 18
      const c1 = O.couleurs[h % 5]!
      const c2 = O.couleurs[(h >> 3) % 5]!
      code += `<path d="M${10 + retrait} ${n(y)}h${l1}" stroke="${c1}" stroke-width="${o.simple ? 4.5 : 3.2}" stroke-linecap="round"/>`
      if (l2 > 4) code += `<path d="M${10 + retrait + l1 + 6} ${n(y)}h${l2}" stroke="${c2}" stroke-width="3.2" stroke-linecap="round"/>`
    }
    const tapG = Math.max(0, Math.sin((t / 0.2) * TAU))
    const tapD = Math.max(0, Math.sin((t / 0.2) * TAU + Math.PI))
    // ecran : repere local 0..72 x 0..56, place en parallelogramme (3/4)
    const ecran =
      `<g transform="matrix(1,-0.139,0.036,1,52,66)">` +
      `<rect x="2" y="3" width="72" height="56" rx="8" fill="${O.grisOmbre}"/>` +
      `<rect width="72" height="56" rx="8" fill="url(#${o.uid}pc)"/>` +
      `<path d="M8 1.2h56" stroke="#fff" stroke-opacity="0.6" stroke-width="1.6" stroke-linecap="round"/>` +
      `<rect x="5" y="5" width="62" height="46" rx="4" fill="${O.ecran}"/>` +
      `<g clip-path="url(#${o.uid}pe)">${code}</g></g>`
    return enveloppe(
      o,
      ombre(o, 104, 150, 58) +
        ecran +
        `<path d="M56 124l72 -10l24 22l-80 12z" fill="url(#${o.uid}pb)" stroke="url(#${o.uid}pb)" stroke-width="7" stroke-linejoin="round"/>` +
        `<path d="M68 127l56 -7.6l13 12l-60 8.4z" fill="${O.gris}" stroke="${O.gris}" stroke-width="3" stroke-linejoin="round" opacity="0.85"/>` +
        `<path d="M72 151.5l80 -12" stroke="${O.grisOmbre}" stroke-width="5" stroke-linecap="round"/>` +
        main(o, 84, 132 - 4 * tapG, -10) +
        main(o, 120, 127 - 4 * tapD, -10),
      lin(`${o.uid}pc`, '#e6e1d9', O.gris, 1, 1) +
        lin(`${o.uid}pb`, '#eeeae3', '#d3cdc4', 1, 1) +
        `<clipPath id="${o.uid}pe"><rect x="5" y="5" width="62" height="46" rx="4"/></clipPath>`
    )
  }
}

/** Video : un clap qui s'ouvre et claque, petit eclat a chaque prise ; l'avatar hoche la tete. */
const clap: Accessoire = {
  id: 'clap',
  boucle: 2,
  geste: (t) => {
    const u = mod(t, 2)
    const choc = cloche(clamp((u - 0.55) / 0.35))
    return versObjet({ pitch: 12 + 8 * choc, dy: 0.02 * choc })
  },
  dessin: (t, o) => {
    const u = mod(t, 2)
    // ouvert a -30 deg, claque vite a 0,55 s, reste ferme, se rouvre doucement
    const angle =
      u < 0.4 ? -30 : u < 0.55 ? -30 * (1 - easings.easeInOutCubic((u - 0.4) / 0.15)) : u < 1.2 ? 0 : -30 * easings.easeInOutCubic(clamp((u - 1.2) / 0.6))
    const eclat = u >= 0.55 && u < 0.85 ? 1 - (u - 0.55) / 0.3 : 0
    const rayures = (y: number) => {
      let s = ''
      for (let i = 0; i < 4; i++) s += `<path d="M${-30 + i * 17} ${y + 12}l9 -12h8l-9 12z" fill="${O.papier}"/>`
      return s
    }
    const bras =
      `<g transform="rotate(${n(angle)} -34 -18)"><rect x="-34" y="-30" width="68" height="12" rx="4" fill="${O.ardoise}"/>` +
      (o.simple ? '' : rayures(-30)) +
      `</g>`
    const corps =
      `<rect x="-32" y="-16" width="68" height="46" rx="7" fill="#2c323c"/>` +
      `<rect x="-34" y="-18" width="68" height="46" rx="7" fill="url(#${o.uid}ca)"/>` +
      `<rect x="-34" y="-18" width="68" height="11" rx="4" fill="${O.ardoise}"/>` +
      (o.simple ? '' : rayures(-18)) +
      `<path d="M-24 2h30M-24 14h44" stroke="${O.papierOmbre}" stroke-opacity="0.75" stroke-width="${o.simple ? 5 : 3.4}" stroke-linecap="round"/>` +
      `<path d="M-27 -6.8h54" stroke="#fff" stroke-opacity="0.18" stroke-width="1.4" stroke-linecap="round"/>`
    const eclats =
      eclat > 0
        ? `<g stroke="${O.couleurs[4]}" stroke-width="4" stroke-linecap="round" opacity="${n(eclat)}"><path d="M44 -34l8 -6M46 -22l10 0M42 -44l3 -9"/></g>`
        : ''
    return enveloppe(
      o,
      ombre(o, 104, 146, 46) + `<g transform="translate(102 112) rotate(-8)">${corps}${bras}${eclats}</g>` + main(o, 72, 132, 70),
      lin(`${o.uid}ca`, O.ardoiseClair, O.ardoise, 1, 1)
    )
  }
}

/** Analyse : un petit graphique dont les barres montent, une loupe qui passe dessus. */
const graphique: Accessoire = {
  id: 'graphique',
  boucle: 4,
  geste: (t) => {
    const u = mod(t, 4)
    const v = clamp((u - 0.4) / 2.8)
    return versObjet({ yaw: 10 + 18 * easings.easeInOutCubic(v), pitch: 13 - 4 * v })
  },
  dessin: (t, o) => {
    const u = mod(t, 4)
    const hauteurs = o.simple ? [18, 30, 42] : [16, 26, 21, 38]
    const largeur = o.simple ? 14 : 10
    const ecart = o.simple ? 20 : 14
    const x0 = o.simple ? -24 : -26
    const fondu = 1 - clamp((u - 3.6) / 0.4)
    let barres = ''
    hauteurs.forEach((h, k) => {
      const f = easings.easeOutCubic(clamp((u - 0.2 - k * 0.45) / 0.7)) * fondu
      const hh = Math.max(0.01, h * f)
      barres += `<rect x="${x0 + k * ecart}" y="${n(22 - hh)}" width="${largeur}" height="${n(hh)}" rx="3" fill="${O.couleurs[[2, 0, 1, 3][k]!]}"/>`
    })
    const v = easings.easeInOutCubic(clamp((u - 0.4) / 2.8))
    const lx = lerp(x0 + 4, x0 + (hauteurs.length - 1) * ecart + 6, v)
    const ly = lerp(4, -12, v)
    const fond =
      `<g transform="translate(100 106) rotate(-6)">${feuille(o, 78, 62)}` +
      `<path d="M-30 23H30" stroke="${O.trait}" stroke-opacity="0.5" stroke-width="2.4" stroke-linecap="round"/>${barres}` +
      `${loupe(o, lx, ly, o.simple ? 13 : 11)}</g>`
    return enveloppe(o, ombre(o, 102, 142, 48) + fond + main(o, 112 + lx * 0.95 + 18, 122 + ly * 0.4 + 14, 45), defsFeuille(o) + defsLoupe(o))
  }
}

/** Publication : un avion en papier part en courbe, disparait, puis revient a la main. */
const avionPos = (t: number) => {
  const u = mod(t, 3.6)
  const depart = { x: 96, y: 104 }
  const loin = { x: 150, y: -128 }
  if (u < 0.5) return { x: depart.x, y: depart.y - 2 * Math.sin((u / 0.5) * Math.PI), rot: -18, k: 1, op: 1, h: 0 }
  if (u < 1.7) {
    const v = easings.easeInOutCubic((u - 0.5) / 1.2)
    const x = lerp(depart.x, loin.x, v) - 40 * Math.sin(v * Math.PI)
    const y = lerp(depart.y, loin.y, v)
    return { x, y, rot: -18 - 40 * v, k: 1 - 0.45 * v, op: 1 - clamp((v - 0.75) / 0.25), h: v }
  }
  if (u < 2.2) return { x: loin.x, y: loin.y, rot: 0, k: 0.55, op: 0, h: 1 }
  const v = easings.easeInOutCubic((u - 2.2) / 1.4)
  const x = lerp(loin.x, depart.x, v) + 30 * Math.sin(v * Math.PI)
  const y = lerp(loin.y, depart.y, v)
  return { x, y, rot: 150 - 168 * v, k: 0.55 + 0.45 * v, op: clamp(v / 0.2), h: 1 - v }
}
const avion: Accessoire = {
  id: 'avion',
  boucle: 3.6,
  geste: (t) => {
    const p = avionPos(t)
    return versObjet({ yaw: 14 + 12 * p.h, pitch: lerp(12, -22, p.h), dy: -0.01 * p.h })
  },
  dessin: (t, o) => {
    const p = avionPos(t)
    const forme =
      `<g stroke="${O.tranche}" stroke-width="1.6" stroke-linejoin="round"><path d="M22 0L-16 -14L-8 0z" fill="url(#${o.uid}av)"/><path d="M22 0L-8 0L-16 12z" fill="${O.papierOmbre}"/></g>` +
      `<path d="M22 0L-8 0L-4 5z" fill="${O.tranche}"/>`
    const sillage =
      !o.simple && p.op > 0 && p.h > 0.05 && p.h < 0.95
        ? `<path d="M${n(p.x)} ${n(p.y)}Q${n(p.x - 30)} ${n(p.y + 34)} ${n(p.x - 26)} ${n(p.y + 64)}" fill="none" stroke="${O.trait}" stroke-opacity="${n(0.35 * p.op)}" stroke-width="2.4" stroke-dasharray="4 7" stroke-linecap="round"/>`
        : ''
    const pose = p.h === 0 ? main(o, 86, 116, -20) : ''
    return enveloppe(
      o,
      ombre(o, 100, 146, 40 * (1 - 0.6 * p.h)) +
        sillage +
        `<g transform="translate(${n(p.x)} ${n(p.y)}) rotate(${n(p.rot)}) scale(${n(p.k * (o.simple ? 1.8 : 1.45))})" opacity="${n(p.op)}">${forme}</g>` +
        pose,
      lin(`${o.uid}av`, '#ffffff', O.papier, 1, 1)
    )
  }
}

/** DA : une toile, un pinceau qui y pose une touche de couleur, une palette. */
const palette: Accessoire = {
  id: 'palette',
  boucle: 14.4,
  geste: (t) => {
    const u = mod(t, 3.6)
    const v = clamp((u - 0.6) / 1.8)
    return versObjet({ pitch: 6 + 4 * Math.sin(v * Math.PI), yaw: 14 + 10 * v, roll: 4 + 3 * Math.sin((t / 1.8) * TAU) })
  },
  dessin: (t, o) => {
    const u = mod(t, 3.6)
    // quatre touches de suite, une couleur par touche : la boucle complete dure 4 x 3,6 s
    const tour = Math.floor(mod(t, 14.4) / 3.6)
    const couleur = O.couleurs[[3, 2, 0, 4][tour]!]!
    const f = easings.easeInOutCubic(clamp((u - 0.6) / 1.8))
    const fondu = 1 - clamp((u - 3.2) / 0.4)
    const d = 'M-18 6C-10 -10 0 14 10 -2S22 0 22 -8'
    // fin du trait : approximation de la courbe pour placer la pointe du pinceau
    const bx = lerp(-18, 22, f)
    const by = 6 - 14 * f + 8 * Math.sin(f * TAU)
    const enAttente = u < 0.6 ? Math.sin((u / 0.6) * Math.PI) : 0
    const pinceau =
      `<g transform="translate(${n(bx + 1)} ${n(by - 2 - 10 * enAttente)}) rotate(-58)">` +
      `<path d="M0 0q3 -5 6 -4v8q-3 1 -6 -4z" fill="${couleur}"/><rect x="5" y="-3.5" width="8" height="7" rx="1.5" fill="${O.grisOmbre}"/>` +
      `<rect x="12" y="-3" width="36" height="6" rx="3" fill="url(#${o.uid}pi)"/></g>`
    const toile =
      `<g transform="translate(104 88) rotate(5)">` +
      `<rect x="-30" y="-34" width="64" height="72" rx="6" fill="${O.boisOmbre}"/>` +
      `<rect x="-32" y="-36" width="64" height="72" rx="6" fill="url(#${o.uid}to)"/>` +
      `<rect x="-26" y="-30" width="52" height="60" rx="3" fill="${O.papier}"/>` +
      `<g opacity="${n(fondu)}">${trait(d, 70, f, couleur, o.simple ? 9 : 7)}</g>` +
      (o.simple ? '' : pinceau) +
      `</g>`
    const pal =
      `<g transform="translate(76 140) rotate(-8)">` +
      `<path d="M-26 0c0 -12 14 -16 28 -14s24 6 24 14s-12 12 -26 12s-26 0 -26 -12z" fill="url(#${o.uid}pa)"/>` +
      `<circle cx="-14" cy="2" r="4.2" fill="${O.papier}"/>` +
      `<circle cx="-2" cy="-7" r="4" fill="${O.couleurs[3]}"/><circle cx="9" cy="-6" r="4" fill="${O.couleurs[2]}"/><circle cx="16" cy="2" r="4" fill="${O.couleurs[0]}"/></g>`
    return enveloppe(
      o,
      ombre(o, 106, 132, 40) + toile + (o.simple ? '' : pal) + main(o, 104 + bx + 26, 96 + by + 26, -58),
      lin(`${o.uid}to`, O.bois, O.boisOmbre, 1, 1) + lin(`${o.uid}pi`, O.bois, O.boisOmbre) + lin(`${o.uid}pa`, '#efe2cb', '#d8c5a6', 1, 1)
    )
  }
}

/** Chef : un presse-papiers, les lignes se cochent une a une. */
const pressePapiers: Accessoire = {
  id: 'presse-papiers',
  boucle: 4.4,
  geste: (t) => {
    const u = mod(t, 4.4)
    const k = Math.min(2, Math.floor(u / 1.1))
    const hoche = cloche(clamp((u - (k * 1.1 + 0.6)) / 0.4))
    return versObjet({ pitch: 12 + k * 3 + 6 * hoche, dy: 0.01 * hoche })
  },
  dessin: (t, o) => {
    const u = mod(t, 4.4)
    const fondu = 1 - clamp((u - 4) / 0.4)
    const nb = o.simple ? 2 : 3
    const ys = o.simple ? [-10, 12] : [-14, 2, 18]
    let lignes = ''
    for (let k = 0; k < nb; k++) {
      const f = clamp((u - (k * (3.3 / nb) + 0.3)) / 0.35) * fondu
      lignes +=
        `<rect x="-21" y="${ys[k]! - 5}" width="10" height="10" rx="2.5" fill="none" stroke="${O.grisOmbre}" stroke-width="${o.simple ? 3 : 2.2}"/>` +
        `<path d="M-4 ${ys[k]}H${k === nb - 1 ? 12 : 20}" stroke="${O.tranche}" stroke-width="${o.simple ? 5 : 3.4}" stroke-linecap="round"/>` +
        coche(-15.5, ys[k]! - 1, 0.9, f, o.simple ? 4 : 3.2)
    }
    const fond =
      `<g transform="translate(102 104) rotate(-7)">` +
      `<rect x="-31" y="-41" width="64" height="84" rx="8" fill="${O.boisOmbre}"/>` +
      `<rect x="-33" y="-43" width="64" height="84" rx="8" fill="url(#${o.uid}pp)"/>` +
      `<rect x="-26" y="-32" width="50" height="68" rx="4" fill="${O.papier}"/>` +
      `<rect x="-12" y="-48" width="22" height="13" rx="4.5" fill="url(#${o.uid}pq)"/>` +
      lignes +
      `</g>`
    return enveloppe(
      o,
      ombre(o, 104, 148, 44) + fond + main(o, 74, 128, 75),
      lin(`${o.uid}pp`, '#dcb98f', O.boisOmbre, 1, 1) + lin(`${o.uid}pq`, '#a9aeb6', '#7d838c')
    )
  }
}

/** Recherche, SEO, sourcing, verification : une loupe descend une liste, chaque ligne lue se coche. */
const liste: Accessoire = {
  id: 'liste',
  boucle: 4.4,
  geste: (t) => {
    const u = mod(t, 4.4)
    const v = clamp(u / 3.6)
    return versObjet({ pitch: 8 + 14 * v, yaw: 16 + 4 * Math.sin((t / 1.1) * TAU) })
  },
  dessin: (t, o) => {
    const u = mod(t, 4.4)
    const fondu = 1 - clamp((u - 4) / 0.4)
    const nb = o.simple ? 3 : 4
    const ys = o.simple ? [-16, 0, 16] : [-18, -6, 6, 18]
    const pas = 3.6 / nb
    let lignes = ''
    for (let k = 0; k < nb; k++) {
      const f = clamp((u - (k + 0.8) * pas) / 0.3) * fondu
      lignes +=
        `<path d="M-12 ${ys[k]}H${[22, 14, 18, 10][k]}" stroke="${O.trait}" stroke-opacity="0.55" stroke-width="${o.simple ? 5 : 3.2}" stroke-linecap="round"/>` +
        coche(-21, ys[k]! - 1, 0.75, f, o.simple ? 4 : 3)
    }
    const v = clamp(u / 3.6)
    const ly = lerp(ys[0]!, ys[nb - 1]!, v) - 4
    const lx = 6 + 6 * Math.sin((t / 1.1) * TAU)
    const fond =
      `<g transform="translate(100 104) rotate(6)">${feuille(o, 64, 70)}${lignes}${loupe(o, lx, ly, o.simple ? 12 : 10)}</g>`
    return enveloppe(o, ombre(o, 102, 146, 42) + fond + main(o, 100 + lx + 26, 120 + ly * 0.9 + 14, 45), defsFeuille(o) + defsLoupe(o))
  }
}

const roue = (dents: number, rext: number, rint: number) => {
  const pts: string[] = []
  for (let i = 0; i < dents * 4; i++) {
    const a = (i / (dents * 4)) * TAU
    const r = i % 4 < 2 ? rext : rint
    pts.push(`${n(Math.cos(a) * r)} ${n(Math.sin(a) * r)}`)
  }
  return `M${pts.join('L')}z`
}

/** Autre : un engrenage qui tourne, un petit qui l'entraine. */
const engrenage: Accessoire = {
  id: 'engrenage',
  boucle: 4,
  geste: (t) => versObjet({ pitch: 10, roll: 3 + 2 * Math.sin((t / 2) * TAU) }),
  dessin: (t, o) => {
    const a = (mod(t, 4) / 4) * 360
    const grand =
      `<g transform="translate(102 110) rotate(${n(a)})"><path d="${roue(8, 30, 23)}" fill="url(#${o.uid}eg)" stroke="url(#${o.uid}eg)" stroke-width="4" stroke-linejoin="round"/>` +
      `<circle r="9" fill="${o.papier}"/><circle r="9" fill="none" stroke="${O.grisOmbre}" stroke-width="2"/></g>`
    const petit = o.simple
      ? ''
      : `<g transform="translate(142 78) rotate(${n(-a * 1.6 + 11)})"><path d="${roue(6, 17, 12)}" fill="url(#${o.uid}ep)" stroke="url(#${o.uid}ep)" stroke-width="3" stroke-linejoin="round"/>` +
        `<circle r="5" fill="${o.papier}"/></g>`
    return enveloppe(
      o,
      ombre(o, 106, 146, 42) + petit + grand,
      lin(`${o.uid}eg`, '#dcd7cf', O.grisOmbre, 1, 1) + lin(`${o.uid}ep`, '#e8c99e', O.boisOmbre, 1, 1)
    )
  }
}

export const ACCESSOIRES: Accessoire[] = [carnet, portable, clap, graphique, avion, palette, pressePapiers, liste, engrenage].map(
  (a): Accessoire => ({ ...a, geste: (t, o) => avecEchelle(a.geste(t), o) })
)

export const ACCESSOIRE_BY_ID = new Map(ACCESSOIRES.map((a) => [a.id, a]))

/**
 * Accessoire par metier (noms de metier usuels, en francais). L'application peut en passer
 * d'autres ; un metier inconnu prend l'engrenage.
 */
export const ACCESSOIRE_DE_METIER: Readonly<Record<string, AccessoireId>> = Object.freeze({
  redaction: 'carnet',
  guides: 'carnet',
  code: 'portable',
  dashboard: 'portable',
  scripts: 'portable',
  video: 'clap',
  analyse: 'graphique',
  publication: 'avion',
  da: 'palette',
  chef: 'presse-papiers',
  recherche: 'liste',
  seo: 'liste',
  sourcing: 'liste',
  qa: 'liste',
  verification: 'liste'
})

export const accessoireDuMetier = (metier: string | undefined | null): Accessoire =>
  ACCESSOIRE_BY_ID.get(ACCESSOIRE_DE_METIER[metier ?? ''] ?? 'engrenage')!
