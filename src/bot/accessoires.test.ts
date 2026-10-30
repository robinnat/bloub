import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { ACCESSOIRES, ACCESSOIRE_BY_ID, ACCESSOIRE_DE_METIER, accessoireDuMetier } from './accessoires'
import { GESTE_NEUTRE } from './gestes'

const o = { uid: 't-', corps: { clair: '#ffe08a', base: '#ffc93d', ombre: '#d19e15' }, papier: '#f5f5f7' }
const temps = [0, 0.13, 0.9, 1.7, 2.45, 3.3, 4.1, 7.77, 12.5]

describe('accessoires', () => {
  it('chaque metier connu a un accessoire, un metier inconnu prend l engrenage', () => {
    for (const id of Object.values(ACCESSOIRE_DE_METIER)) expect(ACCESSOIRE_BY_ID.has(id)).toBe(true)
    expect(accessoireDuMetier('redaction').id).toBe('carnet')
    expect(accessoireDuMetier('code').id).toBe('portable')
    expect(accessoireDuMetier('inconnu').id).toBe('engrenage')
    expect(accessoireDuMetier(undefined).id).toBe('engrenage')
  })

  it('le dessin est pur, sans NaN, sans script ni adresse externe, identifiants prefixes', () => {
    for (const a of ACCESSOIRES) {
      for (const simple of [false, true]) {
        for (const t of temps) {
          const s = a.dessin(t, { ...o, simple })
          expect(s).toBe(a.dessin(t, { ...o, simple }))
          expect(s).not.toMatch(/NaN|undefined|Infinity/)
          expect(s).not.toMatch(/<script|https?:|href=/i)
          for (const m of s.matchAll(/id="([^"]+)"/g)) expect(m[1]!.startsWith('t-')).toBe(true)
          for (const m of s.matchAll(/url\(#([^)]+)\)/g)) expect(s).toContain(`id="${m[1]}"`)
        }
      }
    }
  })

  it('la boucle se raccorde sans couture', () => {
    for (const a of ACCESSOIRES) {
      expect(a.dessin(0.5 + a.boucle, o)).toBe(a.dessin(0.5, o))
      const g1 = a.geste(0.5)
      const g2 = a.geste(0.5 + a.boucle)
      for (const k of Object.keys(g1) as (keyof typeof g1)[]) expect(g2[k]).toBeCloseTo(g1[k], 6)
    }
  })

  it('le geste fait regarder vers l objet sans changer la taille ni la place du corps (echelleCorps 1)', () => {
    for (const a of ACCESSOIRES) {
      for (const t of temps) {
        const g = a.geste(t)
        expect(g.yaw).toBeGreaterThan(5)
        expect(Math.abs(g.dx)).toBeLessThan(0.001)
        expect(Math.abs(g.sx - 1)).toBeLessThan(0.02)
        expect(Math.abs(g.sy - 1)).toBeLessThan(0.03)
        const r = a.geste(t, { echelleCorps: 0.84 })
        expect(r.sx).toBeLessThan(g.sx)
        expect(r.dx).toBeLessThan(0)
        expect(a.geste(t, { echelleCorps: 1 })).toEqual(g)
        expect(Number.isFinite(g.dx + g.dy + g.sx + g.sy + g.yaw + g.pitch + g.roll + g.lid)).toBe(true)
      }
    }
  })

  it('l objet bouge dans le temps (animation visible)', () => {
    for (const a of ACCESSOIRES) {
      const images = new Set([0.2, 0.35, 0.5, 0.65, 0.8].map((k) => a.dessin(k * a.boucle, o)))
      expect(images.size).toBeGreaterThan(2)
    }
  })

  it('le moteur accepte le geste sans etre mute, et rend une image differente du neutre', () => {
    const e = new BotEngine(100, 'idle')
    const ref = JSON.stringify(e.sample(2))
    for (const a of ACCESSOIRES) expect(JSON.stringify(e.sample(2, a.geste(2)))).not.toBe(JSON.stringify(e.sample(2, { ...GESTE_NEUTRE })))
    expect(JSON.stringify(e.sample(2))).toBe(ref)
  })

  it('la version simple est plus legere', () => {
    for (const a of ACCESSOIRES) expect(a.dessin(1.1, { ...o, simple: true }).length).toBeLessThanOrEqual(a.dessin(1.1, o).length)
  })
})
