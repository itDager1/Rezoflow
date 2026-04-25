import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface CharacterColors {
  body: number;
  accent: number;
  emissive: number;
  skin: number;
}

export const CHARACTER_COLORS: Record<string, CharacterColors> = {
  warrior: { body: 0xb91c1c, accent: 0xef4444, emissive: 0xff3300, skin: 0xf5cba7 },
  mage:    { body: 0x5b21b6, accent: 0xa78bfa, emissive: 0x8B5CF6, skin: 0xe9d5ff },
  archer:  { body: 0x065f46, accent: 0x34d399, emissive: 0x00c97a, skin: 0xfcd34d },
  rogue:   { body: 0x0f172a, accent: 0x60a5fa, emissive: 0x3b82f6, skin: 0xfde68a },
  scholar: { body: 0x78350f, accent: 0xfbbf24, emissive: 0xf59e0b, skin: 0xfef3c7 },
};

export const TIER_NAMES = ['Новичок', 'Адепт', 'Эксперт', 'Мастер'];
export const TIER_XP    = [0, 30, 80, 150];
export const TIER_COLORS = ['#6b7280', '#10b981', '#3b82f6', '#f59e0b'];

export function getCharTier(xp: number): number {
  if (xp >= 150) return 3;
  if (xp >= 80)  return 2;
  if (xp >= 30)  return 1;
  return 0;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
type MO = { em?: number; ei?: number; metal?: number; rough?: number; opacity?: number; transparent?: boolean };
const mat = (c: number, o: MO = {}) =>
  new THREE.MeshStandardMaterial({
    color: c, emissive: o.em ?? 0, emissiveIntensity: o.ei ?? 0,
    metalness: o.metal ?? 0.08, roughness: o.rough ?? 0.50,
    opacity: o.opacity ?? 1, transparent: o.transparent ?? false,
  });

const B  = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const C  = (rt: number, rb: number, h: number, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const S  = (r: number, s = 18) => new THREE.SphereGeometry(r, s, s);
const KK = (r: number, h: number, s = 12) => new THREE.ConeGeometry(r, h, s);
const TR = (R: number, r: number, ts = 8, ss = 24) => new THREE.TorusGeometry(R, r, ts, ss);

function mk(geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(geo, m);
}

// ─── base human ──────────────────────────────────────────────────────────────
interface HumanOpts {
  robe?:  boolean;   // long robe instead of pants (mage / scholar)
  riding?: boolean;  // spread legs for horse riding
  darkPants?: boolean;
}

function buildHuman(
  c: CharacterColors,
  tier: number,
  opts: HumanOpts = {},
): { g: THREE.Group; head: THREE.Group } {
  const g = new THREE.Group();
  const ei     = [0, 0.18, 0.45, 0.9][tier];
  const metal  = tier >= 2 ? 0.52 : 0.08;

  const bodyM   = mat(c.body,    { em: c.emissive, ei, metal, rough: 0.45 });
  const accentM = mat(c.accent,  { em: c.emissive, ei: ei * 0.7, metal: metal + 0.1, rough: 0.35 });
  const skinM   = mat(c.skin,    { rough: 0.75 });
  const darkM   = mat(0x111827,  { metal: 0.25, rough: 0.40 });
  const bootM   = mat(0x1c1c1c,  { metal: 0.30, rough: 0.40 });
  const pantsM  = opts.darkPants ? mat(0x0f172a, { metal: 0.15, rough: 0.45 }) : bodyM;

  // ── HEAD ────────────────────────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.set(0, 1.72, 0);

  // skull
  head.add(mk(S(0.275, 24), skinM));

  // cheek puffs
  [-1, 1].forEach(s => {
    const ch = mk(S(0.115, 10), skinM);
    ch.position.set(s * 0.220, -0.045, 0.145); ch.scale.set(1, 0.8, 0.75);
    head.add(ch);
  });

  // jaw
  const jaw = mk(S(0.180, 14), skinM);
  jaw.position.set(0, -0.180, 0.055); jaw.scale.set(0.90, 0.68, 0.82);
  head.add(jaw);

  // forehead protrusion
  const fore = mk(S(0.185, 12), skinM);
  fore.position.set(0, 0.175, 0.055); fore.scale.set(0.94, 0.64, 0.78);
  head.add(fore);

  // ears
  [-1, 1].forEach(s => {
    const ear = mk(S(0.060, 10), skinM);
    ear.position.set(s * 0.293, 0.020, 0); ear.scale.set(0.55, 0.92, 0.48);
    head.add(ear);
  });

  // eyes
  [-0.114, 0.114].forEach(x => {
    const white = mk(S(0.053, 12), mat(0xfafafa, { rough: 0.3 }));
    white.position.set(x, 0.056, 0.248); head.add(white);

    const irisCol = tier >= 2 ? c.emissive : 0x1d4ed8;
    const iris = mk(S(0.036, 10), mat(irisCol, { em: irisCol, ei: tier >= 2 ? 1.2 : 0 }));
    iris.position.set(x, 0.056, 0.268); head.add(iris);

    const pupil = mk(S(0.022, 8), mat(0x050505));
    pupil.position.set(x, 0.056, 0.278); head.add(pupil);

    // eyelid
    const lid = mk(B(0.096, 0.016, 0.012), skinM);
    lid.position.set(x, 0.088, 0.258); head.add(lid);
  });

  // eyebrows
  [-0.114, 0.114].forEach(x => {
    const br = mk(B(0.080, 0.014, 0.010), mat(0x5a3a1a));
    br.position.set(x, 0.138, 0.257); head.add(br);
  });

  // nose bridge + tip + nostrils
  const nb = mk(B(0.023, 0.058, 0.012), skinM);
  nb.position.set(0, 0.038, 0.272); head.add(nb);
  const nt = mk(S(0.027, 10), skinM);
  nt.position.set(0, -0.010, 0.282); head.add(nt);
  [-0.024, 0.024].forEach(x => {
    const n = mk(S(0.015, 8), skinM);
    n.position.set(x, -0.020, 0.275); head.add(n);
  });

  // lips
  const upL = mk(B(0.087, 0.017, 0.010), mat(0xb8664a));
  upL.position.set(0, -0.076, 0.268); head.add(upL);
  const loL = mk(B(0.070, 0.019, 0.012), mat(0xc07060));
  loL.position.set(0, -0.098, 0.266); head.add(loL);

  g.add(head);

  // ── NECK ────────────────────────────────────────────────────────────────
  const neck = mk(C(0.092, 0.112, 0.165, 12), skinM);
  neck.position.set(0, 1.395, 0); g.add(neck);

  // ── TORSO ───────────────────────────────────────────────────────────────
  const chestBox = mk(B(0.80, 0.44, 0.42), bodyM);
  chestBox.position.set(0, 1.06, 0); g.add(chestBox);

  const bellyBox = mk(B(0.68, 0.30, 0.38), bodyM);
  bellyBox.position.set(0, 0.70, 0); g.add(bellyBox);

  // shoulder spheres
  [-0.456, 0.456].forEach(x => {
    const sh = mk(S(0.145, 14), accentM);
    sh.position.set(x, 1.19, 0); g.add(sh);
  });

  // collar ring
  const colr = mk(C(0.145, 0.185, 0.085, 12), bodyM);
  colr.position.set(0, 1.27, 0); g.add(colr);

  // belt
  const belt = mk(B(0.70, 0.080, 0.40), darkM);
  belt.position.set(0, 0.540, 0); g.add(belt);
  const buckle = mk(B(0.090, 0.065, 0.050), accentM);
  buckle.position.set(0, 0.540, 0.205); g.add(buckle);

  // ── ARMS ────────────────────────────────────────────────────────────────
  [{ x: -0.545, s: -1 }, { x: 0.545, s: 1 }].forEach(({ x, s }) => {
    const ua = mk(C(0.096, 0.083, 0.44, 12), bodyM);
    ua.rotation.z = s * 0.12; ua.position.set(x + s * 0.030, 0.93, 0); g.add(ua);

    const el = mk(S(0.082, 12), bodyM);
    el.position.set(x + s * 0.068, 0.70, 0); g.add(el);

    const la = mk(C(0.074, 0.060, 0.38, 12), skinM);
    la.position.set(x + s * 0.100, 0.48, 0); g.add(la);

    const wr = mk(S(0.064, 10), skinM);
    wr.position.set(x + s * 0.120, 0.28, 0); g.add(wr);

    const hand = mk(B(0.100, 0.092, 0.088), skinM);
    hand.position.set(x + s * 0.130, 0.19, 0); g.add(hand);

    const thumb = mk(B(0.037, 0.060, 0.037), skinM);
    thumb.rotation.z = s * 0.35; thumb.position.set(x + s * 0.188, 0.21, 0.022); g.add(thumb);

    const fing = mk(B(0.093, 0.013, 0.073), skinM);
    fing.position.set(x + s * 0.130, 0.138, 0.018); g.add(fing);
  });

  // ── LOWER BODY ──────────────────────────────────────────────────────────
  if (opts.robe) {
    // layered robe
    [
      { w: 0.70, h: 0.32, d: 0.40, y: 0.40 },
      { w: 0.78, h: 0.36, d: 0.44, y: 0.07 },
      { w: 0.86, h: 0.34, d: 0.48, y: -0.24 },
      { w: 0.90, h: 0.16, d: 0.50, y: -0.47 },
    ].forEach(r => {
      const seg = mk(B(r.w, r.h, r.d), bodyM);
      seg.position.set(0, r.y, 0); g.add(seg);
    });
    const seam = mk(B(0.92, 0.040, 0.52), accentM);
    seam.position.set(0, -0.570, 0); g.add(seam);
    [-0.14, 0.14].forEach(x => {
      const sh = mk(B(0.130, 0.090, 0.260), darkM);
      sh.position.set(x, -0.625, 0.058); g.add(sh);
      const toe = mk(S(0.074, 8), darkM);
      toe.position.set(x, -0.625, 0.184); g.add(toe);
    });
  } else if (opts.riding) {
    [{ x: -0.30, rz: 0.42 }, { x: 0.30, rz: -0.42 }].forEach(({ x, rz }) => {
      const th = mk(C(0.115, 0.100, 0.44, 12), pantsM);
      th.rotation.z = rz; th.position.set(x, 0.25, 0.08); g.add(th);

      const kn = mk(S(0.092, 12), pantsM);
      kn.position.set(x > 0 ? 0.49 : -0.49, 0.04, 0.08); g.add(kn);

      const sh = mk(C(0.090, 0.078, 0.38, 12), pantsM);
      sh.rotation.z = x < 0 ? 0.52 : -0.52;
      sh.position.set(x > 0 ? 0.60 : -0.60, -0.18, 0.08); g.add(sh);

      const bt = mk(B(0.160, 0.100, 0.280), bootM);
      bt.position.set(x > 0 ? 0.72 : -0.72, -0.36, 0.08); g.add(bt);
    });
  } else {
    [-0.196, 0.196].forEach(x => {
      const hip = mk(S(0.115, 12), bodyM);
      hip.position.set(x, 0.44, 0); g.add(hip);

      const ul = mk(C(0.112, 0.096, 0.44, 12), pantsM);
      ul.position.set(x, 0.17, 0); g.add(ul);

      const kn = mk(S(0.090, 12), pantsM);
      kn.position.set(x, -0.07, 0); g.add(kn);

      const ll = mk(C(0.090, 0.080, 0.40, 12), pantsM);
      ll.position.set(x, -0.30, 0); g.add(ll);

      const an = mk(S(0.080, 10), bootM);
      an.position.set(x, -0.52, 0); g.add(an);

      const bt = mk(B(0.175, 0.105, 0.300), bootM);
      bt.position.set(x, -0.61, 0.040); g.add(bt);

      const toe = mk(S(0.090, 10), bootM);
      toe.scale.set(0.84, 0.52, 0.87); toe.position.set(x, -0.61, 0.190); g.add(toe);

      const heel = mk(S(0.068, 8), bootM);
      heel.scale.set(0.84, 0.50, 0.74); heel.position.set(x, -0.61, -0.125); g.add(heel);
    });
  }

  return { g, head };
}

// ─── horse ───────────────────────────────────────────────────────────────────
function buildHorse(accentColor: number, tier: number): THREE.Group {
  const g       = new THREE.Group();
  const horseM  = mat(0x4a3220, { rough: 0.70, metal: 0.05 });
  const darkM   = mat(0x2d1f0f, { rough: 0.70 });
  const hoofM   = mat(0x1a1a1a, { metal: 0.25, rough: 0.40 });
  const maneM   = mat(0x1c0f07, { rough: 0.70 });
  const saddleM = mat(0x3d1c0a, { rough: 0.60 });
  const armorM  = mat(accentColor, { em: accentColor, ei: 0.5, metal: 0.70, rough: 0.25 });

  // body
  const body = mk(B(1.90, 0.70, 0.46), horseM);
  g.add(body);

  // rump sphere
  const rump = mk(S(0.320, 14), horseM);
  rump.scale.set(0.78, 0.74, 0.94); rump.position.set(-0.78, 0.160, 0); g.add(rump);

  // chest front
  const chest = mk(S(0.270, 14), horseM);
  chest.scale.set(0.75, 0.84, 0.88); chest.position.set(0.72, 0.105, 0); g.add(chest);

  // neck
  const neck = mk(C(0.152, 0.210, 0.60, 12), horseM);
  neck.rotation.z = -0.48; neck.position.set(0.82, 0.458, 0); g.add(neck);

  // head group
  const hg = new THREE.Group();
  hg.position.set(1.19, 0.80, 0); hg.rotation.z = 0.24;

  hg.add(mk(B(0.480, 0.340, 0.300), horseM));

  const muzzle = mk(B(0.300, 0.220, 0.238), horseM);
  muzzle.position.set(0.300, -0.065, 0); hg.add(muzzle);

  [-0.072, 0.072].forEach(z => {
    const n = mk(S(0.030, 8), darkM);
    n.position.set(0.438, -0.100, z); hg.add(n);
  });

  [-0.155, 0.155].forEach(z => {
    const ew = mk(S(0.036, 10), mat(0xccbb88));
    ew.position.set(0.095, 0.098, z); hg.add(ew);
    const ep = mk(S(0.022, 8), mat(0x111111));
    ep.position.set(0.112, 0.098, z); hg.add(ep);
  });

  [-0.115, 0.115].forEach(z => {
    const ear = mk(KK(0.038, 0.155, 8), horseM);
    ear.rotation.z = 0.10; ear.position.set(-0.105, 0.250, z); hg.add(ear);
  });

  if (tier >= 3) {
    const plate = mk(B(0.220, 0.115, 0.060), armorM);
    plate.position.set(0, 0.115, 0.160); hg.add(plate);
  }
  g.add(hg);

  // mane
  for (let i = 0; i < 7; i++) {
    const mn = mk(B(0.055, 0.185, 0.034), maneM);
    mn.position.set(0.55 + i * 0.12, 0.42 + Math.sin(i * 0.5) * 0.04, 0.225);
    mn.rotation.z = -0.28 + i * 0.06; g.add(mn);
  }

  // tail
  const tail = mk(C(0.050, 0.028, 0.55, 10), maneM);
  tail.rotation.z = 0.55; tail.position.set(-1.13, -0.060, 0); g.add(tail);
  const tailTip = mk(C(0.030, 0.010, 0.38, 8), mat(0x160c04));
  tailTip.rotation.z = 0.65; tailTip.position.set(-1.43, -0.282, 0); g.add(tailTip);

  // legs
  const legPos: [number, number][] = [[-0.52, -0.205], [-0.52, 0.205], [0.47, -0.205], [0.47, 0.205]];
  legPos.forEach(([lx, lz]) => {
    const up = mk(C(0.105, 0.092, 0.44, 10), horseM);
    up.position.set(lx, -0.570, lz); g.add(up);

    const kn = mk(S(0.090, 10), horseM);
    kn.position.set(lx, -0.800, lz); g.add(kn);

    const lo = mk(C(0.075, 0.065, 0.40, 10), darkM);
    lo.position.set(lx, -1.020, lz); g.add(lo);

    const ank = mk(S(0.065, 8), darkM);
    ank.position.set(lx, -1.230, lz); g.add(ank);

    const hoof = mk(C(0.078, 0.070, 0.095, 10), hoofM);
    hoof.position.set(lx, -1.300, lz); g.add(hoof);
  });

  // saddle
  const sadBase = mk(B(0.55, 0.115, 0.42), saddleM);
  sadBase.position.set(0, 0.398, 0); g.add(sadBase);

  const sadBack = mk(B(0.180, 0.210, 0.42), saddleM);
  sadBack.position.set(-0.300, 0.446, 0); g.add(sadBack);

  const sadFront = mk(B(0.140, 0.175, 0.38), saddleM);
  sadFront.position.set(0.280, 0.444, 0); g.add(sadFront);

  // stirrups
  [-0.235, 0.235].forEach(z => {
    const strap = mk(B(0.024, 0.30, 0.024), darkM);
    strap.position.set(0, 0.218, z); g.add(strap);
    const stir = mk(TR(0.054, 0.014, 6, 12), hoofM);
    stir.rotation.y = Math.PI / 2; stir.position.set(0, 0.040, z); g.add(stir);
  });

  // armor plates on horse body (tier 3)
  if (tier >= 3) {
    const bodyPlate = mk(B(0.82, 0.250, 0.080), armorM);
    bodyPlate.position.set(0.30, 0.10, 0.265); g.add(bodyPlate);

    const barding = mk(B(0.50, 0.600, 0.080), armorM);
    barding.position.set(-0.30, 0.080, 0.265); g.add(barding);
  }

  return g;
}

// ─── WARRIOR ─────────────────────────────────────────────────────────────────
function buildWarrior(c: CharacterColors, tier: number): CharResult {
  const onHorse = tier >= 3;
  const { g, head } = buildHuman(c, tier, { riding: onHorse });
  const fns: Array<(t: number) => void> = [];

  const ei      = [0, 0.25, 0.55, 1.0][tier];
  const metal   = tier >= 2 ? 0.65 : 0.12;
  const accentM = mat(c.accent, { em: c.emissive, ei, metal, rough: 0.30 });
  const goldM   = mat(0xd4af37, { em: 0xffcc00, ei: tier >= 3 ? 1.5 : 0.6, metal: 0.80, rough: 0.20 });
  const silverM = mat(0xc8c8d8, { em: 0x888888, ei: 0.30, metal: 0.80, rough: 0.20 });
  const bladeM  = mat(0xdce8f8, { em: 0xaaaaff, ei: tier >= 2 ? 0.55 : 0, metal: 0.90, rough: 0.10 });

  // chest plate (all tiers)
  const cp = mk(B(0.70, 0.38, 0.065), accentM);
  cp.position.set(0, 1.06, 0.22); g.add(cp);
  const cpLine = mk(B(0.040, 0.28, 0.040), goldM);
  cpLine.position.set(0, 1.06, 0.255); g.add(cpLine);

  // ── tier 1: HELMET + SHIELD ───────────────────────────────────────────
  if (tier >= 1) {
    // helmet base
    const hb = mk(C(0.288, 0.288, 0.28, 18), accentM);
    hb.position.set(0, 0.200, 0); head.add(hb);

    const dome = mk(S(0.290, 18), accentM);
    dome.scale.set(1, 0.64, 1); dome.position.set(0, 0.288, 0); head.add(dome);

    // visor slit
    const visor = mk(B(0.300, 0.055, 0.058), silverM);
    visor.position.set(0, 0.048, 0.286); head.add(visor);

    // cheek guards
    [-1, 1].forEach(s => {
      const cg = mk(B(0.068, 0.200, 0.040), accentM);
      cg.position.set(s * 0.265, 0.0, 0.240); head.add(cg);
    });

    // crest
    const crest = mk(B(0.055, 0.190, 0.220), mat(0xcc0000, { em: 0xff0000, ei: 0.3 }));
    crest.position.set(0, 0.455, 0); head.add(crest);

    // neck guard
    const ng = mk(B(0.340, 0.090, 0.040), accentM);
    ng.position.set(0, -0.185, -0.245); head.add(ng);

    // SHIELD (left hand)
    const shBase = mk(B(0.390, 0.470, 0.058), mat(c.body, { em: c.emissive, ei: ei * 0.5, metal: 0.55, rough: 0.35 }));
    shBase.position.set(-0.80, 0.75, 0.055); g.add(shBase);
    const shRim = mk(B(0.430, 0.510, 0.028), accentM);
    shRim.position.set(-0.80, 0.75, 0.022); g.add(shRim);
    const shEm  = mk(S(0.068, 10), goldM);
    shEm.position.set(-0.80, 0.80, 0.090); g.add(shEm);
    const shCH  = mk(B(0.175, 0.028, 0.028), goldM);
    shCH.position.set(-0.80, 0.80, 0.098); g.add(shCH);
    const shCV  = mk(B(0.028, 0.175, 0.028), goldM);
    shCV.position.set(-0.80, 0.80, 0.098); g.add(shCV);
  }

  // ── tier 2: SWORD ─────────────────────────────────────────────────────
  if (tier >= 2) {
    // pommel
    const pommel = mk(S(0.048, 10), goldM);
    pommel.position.set(0.76, 0.55, 0); g.add(pommel);

    // hilt
    const hilt = mk(C(0.028, 0.028, 0.210, 8), goldM);
    hilt.rotation.z = 0.28; hilt.position.set(0.78, 0.69, 0); g.add(hilt);

    // crossguard
    const guard = mk(B(0.395, 0.042, 0.042), silverM);
    guard.rotation.z = 0.28; guard.position.set(0.845, 0.815, 0); g.add(guard);

    // grip wrapping
    const wrap1 = mk(C(0.030, 0.030, 0.055, 8), accentM);
    wrap1.rotation.z = 0.28; wrap1.position.set(0.773, 0.640, 0); g.add(wrap1);
    const wrap2 = mk(C(0.030, 0.030, 0.055, 8), accentM);
    wrap2.rotation.z = 0.28; wrap2.position.set(0.790, 0.738, 0); g.add(wrap2);

    // blade
    const blade = mk(B(0.062, 0.85, 0.022), bladeM);
    blade.rotation.z = 0.28; blade.position.set(0.980, 1.300, 0); g.add(blade);

    // blood groove
    const groove = mk(B(0.012, 0.70, 0.008), mat(0xb0b8e0, { em: 0x8888ff, ei: 0.3 }));
    groove.rotation.z = 0.28; groove.position.set(0.975, 1.295, 0.014); g.add(groove);

    // blade tip
    const tip = mk(KK(0.031, 0.150, 6), bladeM);
    tip.rotation.z = 0.28 + Math.PI; tip.position.set(1.090, 1.770, 0); g.add(tip);
  }

  // ── tier 3: GOLDEN CROWN HELM + CAPE + HORSE ──────────────────────────
  if (tier >= 3) {
    // golden crown on helmet
    const crownBase = mk(C(0.305, 0.305, 0.095, 18), goldM);
    crownBase.position.set(0, 0.295, 0); head.add(crownBase);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const tooth = mk(KK(0, 0.175, 6), goldM);
      tooth.position.set(Math.sin(angle) * 0.265, 0.460, Math.cos(angle) * 0.265);
      head.add(tooth);
    }

    // cape
    const capeM = mat(c.body, { em: c.emissive, ei: 0.40, rough: 0.60 });
    const cape  = mk(B(0.82, 1.12, 0.054), capeM);
    cape.position.set(0, 0.72, -0.24); g.add(cape);
    const capeBot = mk(KK(0.52, 0.26, 8), capeM);
    capeBot.position.set(0, 0.13, -0.245); g.add(capeBot);

    // shoulder armor (pauldrons)
    [-1, 1].forEach(s => {
      const pad = mk(B(0.230, 0.145, 0.285), accentM);
      pad.position.set(s * 0.456, 1.19, 0); g.add(pad);
      const spike = mk(KK(0, 0.165, 6), goldM);
      spike.position.set(s * 0.456, 1.345, 0); g.add(spike);
    });

    // horse
    const horse = buildHorse(c.accent, tier);
    horse.position.set(0, -1.28, 0); g.add(horse);

    // elevate whole group so hooves are at ~-0.70
    g.position.y = 1.10;
  }

  return {
    group: g,
    onAnimate: (t) => fns.forEach(f => f(t)),
    cameraZ: onHorse ? 6.6 : 4.2,
    cameraY: onHorse ? 2.10 : 1.10,
  };
}

// ─── MAGE ─────────────────────────────────────────────────────────────────────
function buildMage(c: CharacterColors, tier: number): CharResult {
  const { g, head } = buildHuman(c, tier, { robe: true });
  const fns: Array<(t: number) => void> = [];

  const ei      = [0, 0.25, 0.55, 1.0][tier];
  const accentM = mat(c.accent,  { em: c.emissive, ei, metal: 0.10, rough: 0.40 });
  const goldM   = mat(0xd4af37,  { em: 0xffcc00, ei: 0.80, metal: 0.70, rough: 0.20 });
  const crystM  = mat(c.accent,  { em: c.emissive, ei: tier >= 2 ? 2.2 : 0.5, metal: 0.10, rough: 0.04, opacity: 0.88, transparent: true });

  // robe accents
  const collar = mk(C(0.230, 0.192, 0.095, 14), accentM);
  collar.position.set(0, 1.27, 0); g.add(collar);
  const strip = mk(B(0.052, 0.78, 0.050), accentM);
  strip.position.set(0, 0.86, 0.222); g.add(strip);
  [0.96, 0.76, 0.55].forEach(y => {
    const btn = mk(S(0.024, 8), goldM);
    btn.position.set(0, y, 0.244); g.add(btn);
  });

  // tier 0: simple wand
  if (tier === 0) {
    const wand = mk(C(0.017, 0.013, 0.60, 8), mat(0x5c3a1e));
    wand.rotation.z = 0.25; wand.position.set(0.68, 0.55, 0); g.add(wand);
    const wt = mk(S(0.030, 8), accentM);
    wt.position.set(0.75, 0.87, 0); g.add(wt);
  }

  // ── tier 1+: WIZARD HAT ───────────────────────────────────────────────
  if (tier >= 1) {
    // brim
    const brim = mk(C(0.490, 0.450, 0.048, 18), accentM);
    brim.position.set(0, 0.155, 0); head.add(brim);

    // body (tall cone)
    const hatBody = mk(KK(0.285, 0.96, 18), accentM);
    hatBody.position.set(0, 0.656, 0); head.add(hatBody);

    // tip
    const hatTip = mk(KK(0.040, 0.175, 10), accentM);
    hatTip.position.set(0, 1.228, 0); head.add(hatTip);

    // hat band
    const band = mk(C(0.290, 0.290, 0.058, 18), goldM);
    band.position.set(0, 0.210, 0); head.add(band);

    // star emblem
    const star = mk(S(0.042, 8), goldM);
    star.position.set(0.078, 0.920, 0.218); head.add(star);

    // moon symbol
    const moon = mk(TR(0.058, 0.014, 6, 12), goldM);
    moon.position.set(0.135, 0.545, 0.226); head.add(moon);

    // rune dots on hat
    [0.3, 0.7, 1.1].forEach(a => {
      const rune = mk(S(0.018, 6), mat(c.accent, { em: c.emissive, ei: 1.0 }));
      rune.position.set(Math.sin(a) * 0.22, 0.36 + a * 0.28, Math.cos(a) * 0.22);
      head.add(rune);
    });
  }

  // ── tier 2+: MAGIC STAFF ─────────────────────────────────────────────
  if (tier >= 2) {
    const staffM = mat(0x3d1e5e, { em: c.emissive, ei: 0.30, metal: 0.20, rough: 0.40 });
    const staff  = mk(C(0.028, 0.022, 1.35, 10), staffM);
    staff.rotation.z = 0.17; staff.position.set(0.68, 0.63, 0); g.add(staff);

    // ring around staff top
    const topRing = mk(TR(0.052, 0.014, 8, 16), goldM);
    topRing.position.set(0.82, 1.34, 0); g.add(topRing);

    // crystal orb
    const orb = mk(S(0.125, 18), crystM);
    orb.position.set(0.84, 1.505, 0); g.add(orb);

    // inner glow
    const glow = mk(S(0.072, 12), mat(c.emissive, { em: c.emissive, ei: 3.5 }));
    glow.position.set(0.84, 1.505, 0); g.add(glow);

    // side crystals
    [-0.085, 0.085].forEach(z => {
      const sc = mk(KK(0.028, 0.115, 6), crystM);
      sc.rotation.x = Math.PI; sc.position.set(0.84, 1.640, z); g.add(sc);
    });

    // runes on staff
    for (let i = 0; i < 4; i++) {
      const rune = mk(TR(0.032, 0.008, 6, 10), mat(c.accent, { em: c.emissive, ei: 1.2 }));
      rune.rotation.z = Math.PI / 2;
      rune.position.set(0.69 + Math.sin(0.17) * (0.30 - i * 0.10), 0.78 + i * 0.14, Math.cos(0.17) * 0.01);
      g.add(rune);
    }
  }

  // ── tier 3+: ORBITING SPHERES + RINGS ────────────────────────────────
  if (tier >= 3) {
    const ringM = mat(c.accent, { em: c.emissive, ei: 2.5, opacity: 0.80, transparent: true });
    const ring1 = mk(TR(0.640, 0.020, 8, 32), ringM);
    ring1.rotation.x = Math.PI / 2; ring1.position.set(0, 0.90, 0); g.add(ring1);

    const ring2 = mk(TR(0.580, 0.016, 8, 32), ringM);
    ring2.rotation.x = Math.PI / 3; ring2.rotation.z = Math.PI / 4;
    ring2.position.set(0, 0.90, 0); g.add(ring2);

    const orbColors = [c.accent, 0xffffff, c.emissive, 0xf0e0ff];
    orbColors.forEach((col, i) => {
      const orb = mk(S(0.062, 10), mat(col, { em: col, ei: 2.6, rough: 0.10 }));
      g.add(orb);
      fns.push((t) => {
        const a = t * 1.55 + (i / 4) * Math.PI * 2;
        orb.position.set(Math.cos(a) * 0.66, 0.90 + Math.sin(t * 2.0 + i) * 0.125, Math.sin(a) * 0.66);
      });
    });

    fns.push((t) => {
      ring1.rotation.y  =  t * 0.80;
      ring2.rotation.y  = -t * 0.52;
    });
  }

  return { group: g, onAnimate: (t) => fns.forEach(f => f(t)) };
}

// ─── ARCHER ──────────────────────────────────────────────────────────────────
function buildArcher(c: CharacterColors, tier: number): CharResult {
  const { g, head } = buildHuman(c, tier, {});
  const fns: Array<(t: number) => void> = [];

  const ei      = [0, 0.20, 0.50, 0.95][tier];
  const accentM = mat(c.accent, { em: c.emissive, ei, metal: 0.10, rough: 0.45 });
  const leathM  = mat(0x5c4010, { rough: 0.75 });
  const woodM   = mat(0x6b3a1f, { rough: 0.70 });
  const arrowM  = mat(0xe0e0e0, { metal: 0.72, rough: 0.20 });
  const bowM    = mat(0x8b4513, { rough: 0.65 });

  // leather vest
  const vest = mk(B(0.72, 0.43, 0.062), leathM);
  vest.position.set(0, 1.06, 0.220); g.add(vest);

  // diagonal straps
  [-0.15, 0.15].forEach(x => {
    const strap = mk(B(0.038, 0.82, 0.040), leathM);
    strap.position.set(x, 0.72, 0.220); g.add(strap);
  });

  // headband tier 0
  if (tier === 0) {
    const band = mk(C(0.287, 0.287, 0.058, 18), leathM);
    band.position.set(0, -0.052, 0); head.add(band);
  }

  // ── tier 1+: QUIVER + RANGER HOOD ────────────────────────────────────
  if (tier >= 1) {
    // quiver
    const quiv = mk(C(0.068, 0.062, 0.55, 10), leathM);
    quiv.rotation.z = 0.16; quiv.position.set(-0.18, 0.88, -0.265); g.add(quiv);

    const quivCap = mk(C(0.075, 0.068, 0.040, 10), mat(0x3d2810));
    quivCap.rotation.z = 0.16; quivCap.position.set(-0.175, 0.618, -0.265); g.add(quivCap);

    // arrows in quiver
    [{ ox: 0, oy: 0 }, { ox: -0.06, oy: 0.03 }, { ox: 0.06, oy: 0.02 }].forEach(({ ox, oy }) => {
      const ar = mk(C(0.008, 0.007, 0.52, 6), woodM);
      ar.rotation.z = 0.16 + ox * 0.5;
      ar.position.set(-0.16 + ox, 1.10 + oy, -0.265); g.add(ar);

      const ah = mk(KK(0.017, 0.052, 6), arrowM);
      ah.rotation.z = 0.16 + ox * 0.5 + Math.PI;
      ah.position.set(-0.14 + ox, 1.395 + oy, -0.265); g.add(ah);

      const fl = mk(KK(0.024, 0.068, 4), mat(0xcc3300));
      fl.rotation.z = 0.16 + ox * 0.5 + Math.PI;
      fl.position.set(-0.185 + ox, 0.845 + oy, -0.265); g.add(fl);
    });

    // ranger hood
    const hoodBase = mk(C(0.292, 0.287, 0.145, 18), mat(c.body, { rough: 0.65 }));
    hoodBase.position.set(0, -0.040, 0); head.add(hoodBase);

    const hoodBack = mk(S(0.295, 18), mat(c.body, { rough: 0.65 }));
    hoodBack.scale.set(1, 0.85, 0.92); hoodBack.position.set(0, 0.020, -0.060); head.add(hoodBack);
  }

  // ── tier 2+: BOW ─────────────────────────────────────────────────────
  if (tier >= 2) {
    // upper and lower limbs
    [-1, 1].forEach(s => {
      const limb = mk(C(0.021, 0.015, 0.56, 8), bowM);
      limb.rotation.z = s * 0.86; limb.position.set(-0.72, 0.78 + s * 0.22, 0.080); g.add(limb);
    });
    // handle
    const handle = mk(C(0.027, 0.027, 0.225, 8), bowM);
    handle.position.set(-0.72, 0.78, 0.080); g.add(handle);
    // grip wrap
    const grip = mk(C(0.030, 0.030, 0.100, 8), accentM);
    grip.position.set(-0.72, 0.78, 0.080); g.add(grip);
    // string
    const strM = mat(0xdddcbb, { rough: 0.40, metal: 0.10 });
    [-1, 1].forEach(s => {
      const str = mk(C(0.005, 0.005, 0.57, 4), strM);
      str.rotation.z = s * 0.73; str.position.set(-0.63, 0.78 + s * 0.27, 0.080); g.add(str);
    });
    // nocked arrow
    const nkd = mk(C(0.010, 0.009, 0.70, 6), woodM);
    nkd.rotation.z = Math.PI / 2; nkd.position.set(-0.72, 0.78, 0.080); g.add(nkd);
    const nkdH = mk(KK(0.021, 0.062, 6), arrowM);
    nkdH.rotation.z = Math.PI / 2; nkdH.position.set(-0.38, 0.78, 0.080); g.add(nkdH);
  }

  // ── tier 3+: FOREST CLOAK + EAGLE ────────────────────────────────────
  if (tier >= 3) {
    const cloakM = mat(0x1a4a1a, { em: c.emissive, ei: 0.30, rough: 0.70, opacity: 0.92, transparent: true });
    const cape   = mk(B(0.80, 1.06, 0.054), cloakM);
    cape.position.set(0, 0.80, -0.235); g.add(cape);
    const capeBot = mk(KK(0.49, 0.195, 8), cloakM);
    capeBot.position.set(0, 0.24, -0.236); g.add(capeBot);

    // leaf pattern on cloak
    [0.90, 0.60, 0.30].forEach(y => {
      [-0.20, 0.20].forEach(x => {
        const leaf = mk(S(0.040, 6), mat(0x0d3d0d, { rough: 0.7 }));
        leaf.scale.set(0.6, 1.2, 0.3); leaf.position.set(x, y, -0.265); g.add(leaf);
      });
    });

    // eagle on right shoulder
    const eagleM = mat(0x3a2808, { rough: 0.60 });
    const eBody  = mk(B(0.215, 0.155, 0.180), eagleM);
    eBody.position.set(0.500, 1.305, 0); g.add(eBody);

    const eHead  = mk(S(0.073, 10), mat(0xfafafa, { rough: 0.50 }));
    eHead.position.set(0.548, 1.450, 0.068); g.add(eHead);

    const eBeak  = mk(KK(0.017, 0.052, 6), mat(0xdd9900));
    eBeak.rotation.x = Math.PI / 2; eBeak.position.set(0.548, 1.418, 0.138); g.add(eBeak);

    const eEye   = mk(S(0.017, 6), mat(0xffcc00, { em: 0xffcc00, ei: 1.5 }));
    eEye.position.set(0.573, 1.452, 0.135); g.add(eEye);

    [-1, 1].forEach(s => {
      const wing = mk(B(0.058, 0.135, 0.275), eagleM);
      wing.rotation.y = s * 0.36; wing.position.set(0.500 + s * 0.135, 1.308, -0.055); g.add(wing);
      const wt = mk(KK(0.028, 0.095, 6), eagleM);
      wt.rotation.z = s * 0.36 + Math.PI / 2;
      wt.position.set(0.500 + s * 0.225, 1.308, -0.100); g.add(wt);
    });
  }

  return { group: g, onAnimate: (t) => fns.forEach(f => f(t)) };
}

// ─── ROGUE ───────────────────────────────────────────────────────────────────
function buildRogue(c: CharacterColors, tier: number): CharResult {
  const { g, head } = buildHuman(c, tier, { darkPants: true });
  const fns: Array<(t: number) => void> = [];

  const ei      = [0, 0.20, 0.55, 1.0][tier];
  const accentM = mat(c.accent, { em: c.emissive, ei, metal: 0.20, rough: 0.35 });
  const darkM   = mat(0x060612, { metal: 0.22, rough: 0.40 });
  const bladeM  = mat(0xd0d8f5, { em: 0x8888ff, ei: tier >= 2 ? 0.85 : 0, metal: 0.90, rough: 0.05 });

  // dark leather overlay
  const vest = mk(B(0.72, 0.80, 0.058), darkM);
  vest.position.set(0, 0.92, 0.222); g.add(vest);

  // crossed straps
  [-1, 1].forEach(s => {
    const diag = mk(B(0.026, 0.72, 0.040), mat(0x1c1c2e, { rough: 0.50 }));
    diag.rotation.z = s * 0.28; diag.position.set(s * 0.155, 0.92, 0.226); g.add(diag);
  });

  // lower face wrap (all tiers)
  const mask = mk(B(0.380, 0.130, 0.038), darkM);
  mask.position.set(0, -0.100, 0.270); head.add(mask);

  // ── tier 1+: HOOD ─────────────────────────────────────────────────────
  if (tier >= 1) {
    const hoodSphere = mk(S(0.307, 20), darkM);
    hoodSphere.scale.set(1, 1.04, 1); hoodSphere.position.set(0, 0.058, -0.040); head.add(hoodSphere);

    const peak = mk(KK(0.095, 0.215, 10), darkM);
    peak.position.set(-0.058, 0.355, -0.030); peak.rotation.z = -0.20; head.add(peak);

    const drape = mk(B(0.310, 0.270, 0.040), darkM);
    drape.position.set(0, -0.225, -0.248); head.add(drape);

    // face mask covering mouth/nose
    const fm = mk(B(0.375, 0.155, 0.038), mat(0x0a0a18, { rough: 0.45 }));
    fm.position.set(0, -0.102, 0.266); head.add(fm);

    // fabric fold lines on mask
    [-0.06, 0.06].forEach(x => {
      const fold = mk(B(0.010, 0.130, 0.010), mat(0x080814));
      fold.position.set(x, -0.102, 0.270); head.add(fold);
    });
  }

  // ── tier 2+: DUAL DAGGERS ─────────────────────────────────────────────
  if (tier >= 2) {
    [{ x: 0.64, s: 1 }, { x: -0.64, s: -1 }].forEach(({ x, s }) => {
      const hiltM = mat(0x1a1a2e, { metal: 0.55, rough: 0.30 });

      const pommel = mk(S(0.030, 8), accentM);
      pommel.position.set(x, 0.36, 0.060); g.add(pommel);

      const hilt = mk(C(0.024, 0.024, 0.180, 8), hiltM);
      hilt.rotation.z = s * 0.24; hilt.position.set(x, 0.475, 0.060); g.add(hilt);

      // grip wraps
      [0.42, 0.52].forEach(y => {
        const wr = mk(C(0.028, 0.028, 0.048, 8), accentM);
        wr.rotation.z = s * 0.24; wr.position.set(x + s * (y - 0.42) * 0.02, y, 0.060); g.add(wr);
      });

      const guard = mk(B(0.190, 0.032, 0.032), mat(c.accent, { em: c.emissive, ei: ei * 0.5 }));
      guard.rotation.z = s * 0.24; guard.position.set(x + s * 0.028, 0.578, 0.060); g.add(guard);

      const blade = mk(B(0.038, 0.445, 0.018), bladeM);
      blade.rotation.z = s * 0.24; blade.position.set(x + s * 0.055, 0.820, 0.060); g.add(blade);

      const tip = mk(KK(0.019, 0.095, 4), bladeM);
      tip.rotation.z = s * 0.24 + Math.PI; tip.position.set(x + s * 0.073, 1.066, 0.060); g.add(tip);

      // blood groove
      const bg = mk(B(0.010, 0.360, 0.006), mat(0xa0a8e0, { em: 0x7777cc, ei: 0.5 }));
      bg.rotation.z = s * 0.24; bg.position.set(x + s * 0.050, 0.820, 0.066); g.add(bg);
    });
  }

  // ── tier 3+: SHADOW CAPE + GHOST PARTICLES ───────────────────────────
  if (tier >= 3) {
    const capeM = mat(0x04040e, { em: c.emissive, ei: 0.40, rough: 0.80, opacity: 0.88, transparent: true });
    const cape  = mk(B(0.84, 1.06, 0.050), capeM);
    cape.position.set(0, 0.78, -0.242); g.add(cape);
    const capeBot = mk(KK(0.54, 0.28, 8), capeM);
    capeBot.position.set(0, 0.19, -0.243); g.add(capeBot);

    // shadow edge trim
    const trimM = mat(c.accent, { em: c.emissive, ei: 1.2, opacity: 0.7, transparent: true });
    [-0.405, 0.405].forEach(x => {
      const trim = mk(B(0.025, 1.06, 0.020), trimM);
      trim.position.set(x, 0.78, -0.235); g.add(trim);
    });

    // glowing eyes through hood
    const eyeGlowM = mat(c.emissive, { em: c.emissive, ei: 4.5 });
    [-0.090, 0.090].forEach(x => {
      const eg = mk(S(0.021, 8), eyeGlowM);
      eg.position.set(x, 0.050, 0.272); head.add(eg);
    });

    // shadow wisps (animated)
    const wispM = mat(c.accent, { em: c.emissive, ei: 3.0, opacity: 0.65, transparent: true });
    const wisps: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const w = mk(S(0.028 + (i % 3) * 0.012, 6), wispM);
      g.add(w); wisps.push(w);
    }
    fns.push((t) => {
      wisps.forEach((w, i) => {
        const a = t * 1.25 + (i / 6) * Math.PI * 2;
        w.position.set(
          Math.cos(a) * 0.44,
          -0.28 + Math.sin(t * 1.9 + i) * 0.26,
          Math.sin(a) * 0.44,
        );
        (w.material as THREE.MeshStandardMaterial).opacity = 0.35 + Math.sin(t * 2.8 + i * 1.3) * 0.28;
      });
    });
  }

  return { group: g, onAnimate: (t) => fns.forEach(f => f(t)) };
}

// ─── SCHOLAR ─────────────────────────────────────────────────────────────────
function buildScholar(c: CharacterColors, tier: number): CharResult {
  const { g, head } = buildHuman(c, tier, { robe: true });
  const fns: Array<(t: number) => void> = [];

  const ei      = [0, 0.18, 0.45, 0.90][tier];
  const accentM = mat(c.accent, { em: c.emissive, ei, metal: 0.10, rough: 0.50 });
  const goldM   = mat(0xd4af37, { em: 0xffcc00, ei: 0.75, metal: 0.70, rough: 0.22 });
  const parchM  = mat(0xf5e6c8, { rough: 0.88 });
  const inkM    = mat(0x111111, { rough: 0.80 });

  // robe details
  const collar = mk(C(0.240, 0.194, 0.096, 14), accentM);
  collar.position.set(0, 1.27, 0); g.add(collar);

  [-0.30, 0, 0.30].forEach(x => {
    const stripe = mk(B(0.048, 0.82, 0.040), accentM);
    stripe.position.set(x, 0.21, 0.236); g.add(stripe);
  });

  // pocket
  const pocket = mk(B(0.14, 0.14, 0.038), mat(c.body, { rough: 0.5 }));
  pocket.position.set(0.24, 0.64, 0.235); g.add(pocket);
  const pocketRim = mk(B(0.15, 0.015, 0.025), accentM);
  pocketRim.position.set(0.24, 0.715, 0.240); g.add(pocketRim);

  // tier 0: quill in right hand
  if (tier === 0) {
    const quill = mk(C(0.013, 0.006, 0.62, 6), mat(0xfafafa));
    quill.rotation.z = 0.28; quill.position.set(0.675, 0.545, 0); g.add(quill);
    const qBase = mk(KK(0.038, 0.115, 6), mat(0xe8e0d0));
    qBase.rotation.z = 0.28 + Math.PI; qBase.position.set(0.575, 0.248, 0); g.add(qBase);
    const qTip = mk(KK(0.010, 0.050, 4), mat(0x111111));
    qTip.rotation.z = 0.28 + Math.PI; qTip.position.set(0.770, 0.840, 0); g.add(qTip);
  }

  // ── tier 1+: OPEN BOOK ────────────────────────────────────────────────
  if (tier >= 1) {
    const bookGroup = new THREE.Group();
    bookGroup.position.set(0, 0.60, 0.245); bookGroup.rotation.x = -0.30;

    const cover = mk(B(0.520, 0.370, 0.038), mat(c.body, { rough: 0.60 }));
    bookGroup.add(cover);

    const spine  = mk(B(0.038, 0.370, 0.075), mat(c.body, { rough: 0.55 }));
    spine.position.set(0, 0, -0.010); bookGroup.add(spine);

    const pageL = mk(B(0.225, 0.315, 0.014), parchM);
    pageL.position.set(-0.118, 0, 0.025); bookGroup.add(pageL);

    const pageR = mk(B(0.225, 0.315, 0.014), parchM);
    pageR.position.set(0.118, 0, 0.025); bookGroup.add(pageR);

    // page curl edge
    [-1, 1].forEach(s => {
      const curl = mk(B(0.010, 0.315, 0.014), mat(0xe8d9b5));
      curl.position.set(s * 0.228, 0, 0.020); bookGroup.add(curl);
    });

    // ink lines
    [-0.118, 0.118].forEach(px => {
      for (let r = 0; r < 6; r++) {
        const line = mk(B(0.168, 0.010, 0.008), inkM);
        line.position.set(px, -0.115 + r * 0.054, 0.033); bookGroup.add(line);
      }
    });

    // gold corner clasps
    [[-0.250, 0.178], [0.250, 0.178], [-0.250, -0.178], [0.250, -0.178]].forEach(([bx, by]) => {
      const clasp = mk(S(0.018, 6), goldM);
      clasp.position.set(bx, by, 0.025); bookGroup.add(clasp);
    });

    g.add(bookGroup);
  }

  // ── tier 2+: GLASSES + MORTARBOARD ───────────────────────────────────
  if (tier >= 2) {
    const glassM = mat(0xd4af37, { em: 0xffcc00, ei: 0.50, metal: 0.82, rough: 0.18 });
    const lensM  = mat(0x88bbdd, { em: 0x4488aa, ei: 0.50, metal: 0, rough: 0.04, opacity: 0.52, transparent: true });

    // frames
    [-0.114, 0.114].forEach(x => {
      const frame = mk(TR(0.051, 0.011, 8, 16), glassM);
      frame.rotation.x = Math.PI / 2; frame.position.set(x, 0.056, 0.291); head.add(frame);
      const lens = mk(S(0.038, 10), lensM);
      lens.position.set(x, 0.056, 0.306); head.add(lens);
    });

    // bridge
    const bridge = mk(B(0.092, 0.008, 0.008), glassM);
    bridge.position.set(0, 0.056, 0.290); head.add(bridge);

    // arms
    [-1, 1].forEach(s => {
      const arm = mk(B(0.135, 0.006, 0.006), glassM);
      arm.position.set(s * 0.188, 0.056, 0.228); arm.rotation.y = s * 0.28; head.add(arm);
    });

    // mortarboard
    const boardBase = mk(C(0.288, 0.288, 0.058, 18), mat(c.body, { rough: 0.60 }));
    boardBase.position.set(0, 0.175, 0); head.add(boardBase);

    const top = mk(B(0.590, 0.028, 0.590), mat(c.body, { rough: 0.60 }));
    top.rotation.y = Math.PI / 6; top.position.set(0, 0.280, 0); head.add(top);

    // tassel
    const tasStr = mk(C(0.009, 0.009, 0.275, 4), accentM);
    tasStr.rotation.z = 0.52; tasStr.position.set(0.178, 0.252, 0); head.add(tasStr);
    const tasBall = mk(S(0.028, 8), accentM);
    tasBall.position.set(0.298, 0.130, 0); head.add(tasBall);

    // academic pin
    const pin = mk(S(0.018, 6), goldM);
    pin.position.set(0.242, 0.650, 0.240); g.add(pin);
  }

  // ── tier 3+: ORBITING BOOKS ───────────────────────────────────────────
  if (tier >= 3) {
    const ringM = mat(c.accent, { em: c.emissive, ei: 2.0, opacity: 0.72, transparent: true });
    const aura  = mk(TR(0.680, 0.017, 8, 32), ringM);
    aura.rotation.x = Math.PI / 2; aura.position.set(0, 0.82, 0); g.add(aura);
    fns.push((t) => { aura.rotation.y = t * 0.58; });

    const bookCols = [c.body, 0x1e3a5f, 0x2d4a1e, 0x4a1e1e];
    bookCols.forEach((bColor, i) => {
      const bg = new THREE.Group();

      const bk = mk(B(0.185, 0.245, 0.038), mat(bColor, { rough: 0.60 }));
      bg.add(bk);

      const pg = mk(B(0.140, 0.200, 0.014), parchM);
      pg.position.set(0, 0, 0.028); bg.add(pg);

      const sp2 = mk(B(0.024, 0.245, 0.038), mat(bColor, { rough: 0.55 }));
      sp2.position.set(-0.107, 0, 0); bg.add(sp2);

      // lines on page
      for (let r = 0; r < 4; r++) {
        const ln = mk(B(0.105, 0.008, 0.006), inkM);
        ln.position.set(0.010, -0.065 + r * 0.045, 0.034); bg.add(ln);
      }

      // glowing clasp on cover
      const clasp = mk(S(0.015, 6), goldM);
      clasp.position.set(0.095, 0.120, 0.022); bg.add(clasp);

      g.add(bg);
      fns.push((t) => {
        const a = t * 0.92 + (i / 4) * Math.PI * 2;
        bg.position.set(
          Math.cos(a) * 0.74,
          0.85 + Math.sin(t * 1.40 + i * 1.12) * 0.14,
          Math.sin(a) * 0.74,
        );
        bg.rotation.y = -a + Math.PI / 2;
        bg.rotation.x = Math.sin(t * 0.78 + i) * 0.20;
      });
    });
  }

  return { group: g, onAnimate: (t) => fns.forEach(f => f(t)) };
}

// ─── dispatch ────────────────────────────────────────────────────────────────
interface CharResult {
  group: THREE.Group;
  onAnimate: (t: number) => void;
  cameraZ?: number;
  cameraY?: number;
}

function buildCharacter(id: string, c: CharacterColors, tier: number): CharResult {
  switch (id) {
    case 'warrior': return buildWarrior(c, tier);
    case 'archer':  return buildArcher(c, tier);
    case 'rogue':   return buildRogue(c, tier);
    case 'scholar': return buildScholar(c, tier);
    default:        return buildMage(c, tier);
  }
}

// ─── component ───────────────────────────────────────────────────────────────
interface CharacterCanvasProps {
  characterId: string;
  tier: number;
  size?: number;
  interactive?: boolean;
}

export function CharacterCanvas({ characterId, tier, size = 280, interactive = false }: CharacterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const colors = CHARACTER_COLORS[characterId] ?? CHARACTER_COLORS.mage;
    const { group: charGroup, onAnimate, cameraZ = 4.2, cameraY = 1.1 } = buildCharacter(characterId, colors, tier);

    // scene
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, cameraY, cameraZ);
    camera.lookAt(0, cameraY * 0.64, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFShadowMap;

    // lighting
    scene.add(new THREE.AmbientLight(0xffffff, tier >= 3 ? 0.65 : 0.45));

    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(3, 7, 5); key.castShadow = true; scene.add(key);

    const fill = new THREE.DirectionalLight(0x9999ff, 0.30);
    fill.position.set(-4, 2, -3); scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.18);
    rim.position.set(0, -2, -4); scene.add(rim);

    if (tier >= 1) {
      const pt = new THREE.PointLight(colors.emissive, [0, 0.40, 1.25, 2.90][tier], 9);
      pt.position.set(0, cameraY * 0.85, 2.50); scene.add(pt);
    }

    // floor ring
    const floorRingMat = new THREE.MeshStandardMaterial({
      color: colors.accent, emissive: colors.emissive,
      emissiveIntensity: [0, 0.30, 0.60, 1.20][tier],
      transparent: true, opacity: 0.35,
    });
    const floorRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.030, 8, 48), floorRingMat);
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = characterId === 'warrior' && tier >= 3 ? 0.38 : -0.70;
    scene.add(floorRing);

    scene.add(charGroup);

    // ── Manual drag rotation (only when interactive) ──────────────────────
    let manualRotY = 0;
    let isDragging = false;
    let lastClientX = 0;
    let velocityX = 0;

    if (interactive) {
      canvas.style.cursor = 'grab';

      const onMouseDown = (e: MouseEvent) => {
        isDragging = true;
        lastClientX = e.clientX;
        velocityX = 0;
        canvas.style.cursor = 'grabbing';
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - lastClientX;
        velocityX = dx;
        manualRotY += dx * 0.012;
        lastClientX = e.clientX;
      };
      const onMouseUp = () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
      };
      const onTouchStart = (e: TouchEvent) => {
        isDragging = true;
        lastClientX = e.touches[0].clientX;
        velocityX = 0;
      };
      const onTouchMove = (e: TouchEvent) => {
        if (!isDragging) return;
        const dx = e.touches[0].clientX - lastClientX;
        velocityX = dx;
        manualRotY += dx * 0.012;
        lastClientX = e.touches[0].clientX;
      };
      const onTouchEnd = () => { isDragging = false; };

      canvas.addEventListener('mousedown',  onMouseDown);
      window.addEventListener('mousemove',  onMouseMove);
      window.addEventListener('mouseup',    onMouseUp);
      canvas.addEventListener('touchstart', onTouchStart, { passive: true });
      canvas.addEventListener('touchmove',  onTouchMove,  { passive: true });
      canvas.addEventListener('touchend',   onTouchEnd);

      (canvas as any)._cleanupDrag = () => {
        canvas.removeEventListener('mousedown',  onMouseDown);
        window.removeEventListener('mousemove',  onMouseMove);
        window.removeEventListener('mouseup',    onMouseUp);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove',  onTouchMove);
        canvas.removeEventListener('touchend',   onTouchEnd);
      };
    }

    // animation loop
    let t = 0;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      t += 0.016;

      if (interactive) {
        if (!isDragging) {
          velocityX *= 0.88;
          manualRotY += velocityX * 0.012;
        }
        charGroup.rotation.y = manualRotY;
      } else {
        charGroup.rotation.y = Math.sin(t * 0.38) * 0.35;
      }

      charGroup.position.y += (Math.sin(t * 1.05) * 0.036 - charGroup.position.y) * 0.1;
      floorRing.rotation.z += 0.005 * (tier + 1);
      onAnimate(t);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      if ((canvas as any)._cleanupDrag) {
        (canvas as any)._cleanupDrag();
        delete (canvas as any)._cleanupDrag;
      }
    };
  }, [characterId, tier, size, interactive]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
