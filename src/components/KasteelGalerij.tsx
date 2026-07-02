"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface Kunstwerk {
  titel: string;
  url: string;
}

/* ---------- Procedurele canvas-textures ---------- */

function canvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function maakSchaakbordTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(512, (ctx, s) => {
    const n = 8;
    const vak = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? "#e8e0d0" : "#3a3a44";
        ctx.fillRect(i * vak, j * vak, vak, vak);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function maakSteenTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = "#d8d2c4";
    ctx.fillRect(0, 0, s, s);
    const rijHoogte = s / 8;
    for (let rij = 0; rij < 8; rij++) {
      const offset = rij % 2 === 0 ? 0 : s / 8;
      for (let k = -1; k < 4; k++) {
        const x = k * (s / 4) + offset;
        const tint = 200 + Math.floor(Math.random() * 30);
        ctx.fillStyle = `rgb(${tint},${tint - 6},${tint - 20})`;
        ctx.fillRect(x + 3, rij * rijHoogte + 3, s / 4 - 6, rijHoogte - 6);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function maakGrasTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = "#4c9e3f";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1500; i++) {
      const g = 130 + Math.floor(Math.random() * 60);
      ctx.fillStyle = `rgb(${g - 70},${g},${g - 80})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 40);
  return tex;
}

function maakGlasInLoodTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (ctx, s) => {
    const kleuren = ["#e5528a", "#f2c14e", "#5aa9e6", "#7bc950", "#b07be0"];
    const n = 5;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = kleuren[(i * 3 + j) % kleuren.length];
        ctx.fillRect((i * s) / n, (j * s) / n, s / n, s / n);
      }
    }
    ctx.strokeStyle = "#2b2b33";
    ctx.lineWidth = 6;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo((i * s) / n, 0);
      ctx.lineTo((i * s) / n, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i * s) / n);
      ctx.lineTo(s, (i * s) / n);
      ctx.stroke();
    }
  });
}

function maakPlacardTexture(titel: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#f5e6b8";
  ctx.fillRect(8, 8, 496, 112);
  ctx.fillStyle = "#3a3020";
  ctx.font = "bold 40px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const kort = titel.length > 26 ? titel.slice(0, 25) + "…" : titel;
  ctx.fillText(kort, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function maakPlaatshouderTexture(index: number): THREE.CanvasTexture {
  return canvasTexture(512, (ctx, s) => {
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, `hsl(${(index * 47) % 360}, 70%, 60%)`);
    grad.addColorStop(1, `hsl(${(index * 47 + 80) % 360}, 70%, 40%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("mindofmaxi.com", s / 2, s / 2 - 10);
    ctx.font = "24px sans-serif";
    ctx.fillText("kon niet geladen worden", s / 2, s / 2 + 30);
  });
}

/* ---------- Hoofdcomponent ---------- */

export default function KasteelGalerij() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [laden, setLaden] = useState(true);
  const [aantal, setAantal] = useState<number | null>(null);
  const [fallback, setFallback] = useState(false);
  const [huidigeTitel, setHuidigeTitel] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let gestopt = false;
    let rafId = 0;

    /* --- Renderer, scene, camera --- */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x76b6f0);
    scene.fog = new THREE.Fog(0x76b6f0, 60, 160);

    const camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.1,
      300
    );
    camera.rotation.order = "YXZ";

    /* --- Licht --- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const hemel = new THREE.HemisphereLight(0xbfdfff, 0x4c9e3f, 0.5);
    scene.add(hemel);
    const zon = new THREE.DirectionalLight(0xfff3d6, 1.1);
    zon.position.set(30, 50, 20);
    scene.add(zon);

    /* --- Botsingen --- */
    const obstakels: THREE.Box3[] = [];
    const voegObstakel = (mesh: THREE.Mesh) => {
      mesh.updateMatrixWorld(true);
      obstakels.push(new THREE.Box3().setFromObject(mesh));
    };

    /* --- Materialen --- */
    const steenTex = maakSteenTexture();
    steenTex.repeat.set(3, 1.5);
    const muurMat = new THREE.MeshLambertMaterial({ map: steenTex });
    const binnenMuurMat = new THREE.MeshLambertMaterial({ color: 0xf0e6d2 });
    const dakMat = new THREE.MeshLambertMaterial({ color: 0xd23c3c });
    const goudMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.7,
      roughness: 0.35,
    });

    /* --- Afmetingen van het kasteel --- */
    const FACADE_Z = -20; // voorkant kasteel
    const MUURDIKTE = 1;
    const HAL_BREEDTE = 28; // binnenmaat x: -14..14
    const HAL_HOOGTE = 9;
    const DEUR_BREEDTE = 3.2;
    const DEUR_HOOGTE = 4.4;

    /* --- Buitenwereld --- */
    const gras = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshLambertMaterial({ map: maakGrasTexture() })
    );
    gras.rotation.x = -Math.PI / 2;
    scene.add(gras);

    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 40),
      new THREE.MeshLambertMaterial({ color: 0xcfc6ae })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.01, 0);
    scene.add(pad);

    // Wolken
    for (let i = 0; i < 8; i++) {
      const wolk = new THREE.Mesh(
        new THREE.SphereGeometry(4 + Math.random() * 3, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      wolk.scale.y = 0.35;
      wolk.position.set(
        (Math.random() - 0.5) * 180,
        28 + Math.random() * 14,
        (Math.random() - 0.5) * 180
      );
      scene.add(wolk);
    }

    // Bomen
    for (const [tx, tz] of [[-14, 2], [14, -2], [-20, -8], [22, -6], [-9, 12], [10, 14]]) {
      const stam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 2.4, 8),
        new THREE.MeshLambertMaterial({ color: 0x7a5230 })
      );
      stam.position.set(tx, 1.2, tz);
      const kruin = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 12, 10),
        new THREE.MeshLambertMaterial({ color: 0x3e8c34 })
      );
      kruin.position.set(tx, 3.4, tz);
      scene.add(stam, kruin);
      voegObstakel(stam);
    }

    /* --- Kunstwerken laden en hal bouwen --- */
    const schilderijMeshes: THREE.Mesh[] = [];
    const textureLoader = new THREE.TextureLoader();

    function maakSchilderij(
      werk: Kunstwerk,
      index: number,
      gebruikPlaatshouder: boolean
    ): THREE.Group {
      const groep = new THREE.Group();

      const MAX_B = 2.7;
      const MAX_H = 2.1;
      const doek = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshLambertMaterial({ color: 0xeeeeee })
      );
      doek.scale.set(2.2, 1.7, 1);
      doek.userData.titel = werk.titel;

      const lijst = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.12), goudMat);
      const pasLijstAan = () => {
        lijst.scale.set(doek.scale.x + 0.3, doek.scale.y + 0.3, 1);
      };
      lijst.position.z = -0.065;
      pasLijstAan();

      const zetTexture = (tex: THREE.Texture, breedte: number, hoogte: number) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const aspect = breedte / hoogte;
        let b = MAX_B;
        let h = b / aspect;
        if (h > MAX_H) {
          h = MAX_H;
          b = h * aspect;
        }
        doek.scale.set(b, h, 1);
        pasLijstAan();
        (doek.material as THREE.MeshLambertMaterial).map = tex;
        (doek.material as THREE.MeshLambertMaterial).color.set(0xffffff);
        (doek.material as THREE.MeshLambertMaterial).needsUpdate = true;
      };

      if (gebruikPlaatshouder) {
        const tex = maakPlaatshouderTexture(index);
        zetTexture(tex, 4, 3);
      } else {
        const proxyUrl = `/api/kunstwerken/afbeelding?url=${encodeURIComponent(werk.url)}`;
        textureLoader.load(proxyUrl, (tex) => {
          if (gestopt) return;
          zetTexture(tex, tex.image.width, tex.image.height);
        });
      }

      const placard = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 0.32),
        new THREE.MeshLambertMaterial({ map: maakPlacardTexture(werk.titel) })
      );
      placard.position.set(0, -1.55, 0.02);

      groep.add(lijst, doek, placard);
      schilderijMeshes.push(doek);
      return groep;
    }

    function bouwKasteel(werken: Kunstwerk[], gebruikPlaatshouder: boolean) {
      const SPATIE = 4.4;
      const OOG_Y = 2.3;

      // Slots op de achterwand en naast de deur
      const achterSlots = 5;
      const voorSlotsPerKant = 2;
      const vasteSlots = achterSlots + voorSlotsPerKant * 2;
      const perZijkant = Math.max(3, Math.ceil((werken.length - vasteSlots) / 2));
      const halLengte = Math.max(30, perZijkant * SPATIE + 8);
      const ACHTER_Z = FACADE_Z - MUURDIKTE - halLengte;
      const halfB = HAL_BREEDTE / 2;

      /* Gevel met deuropening (drie delen) */
      const gevelSegB = (HAL_BREEDTE + 2 * MUURDIKTE + 6 - DEUR_BREEDTE) / 2;
      for (const kant of [-1, 1]) {
        const deel = new THREE.Mesh(
          new THREE.BoxGeometry(gevelSegB, 11, MUURDIKTE),
          muurMat
        );
        deel.position.set(
          kant * (DEUR_BREEDTE / 2 + gevelSegB / 2),
          5.5,
          FACADE_Z - MUURDIKTE / 2
        );
        scene.add(deel);
        voegObstakel(deel);
      }
      const latei = new THREE.Mesh(
        new THREE.BoxGeometry(DEUR_BREEDTE, 11 - DEUR_HOOGTE, MUURDIKTE),
        muurMat
      );
      latei.position.set(0, DEUR_HOOGTE + (11 - DEUR_HOOGTE) / 2, FACADE_Z - MUURDIKTE / 2);
      scene.add(latei);
      voegObstakel(latei);

      // Glas-in-loodraam boven de deur
      const raam = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ map: maakGlasInLoodTexture() })
      );
      raam.position.set(0, 7.5, FACADE_Z + 0.02);
      scene.add(raam);

      /* Torens */
      const torenPosities: [number, number][] = [
        [-halfB - 2.5, FACADE_Z - 1],
        [halfB + 2.5, FACADE_Z - 1],
        [-halfB - 2.5, ACHTER_Z + 1],
        [halfB + 2.5, ACHTER_Z + 1],
      ];
      for (const [tx, tz] of torenPosities) {
        const toren = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 14, 16), muurMat);
        toren.position.set(tx, 7, tz);
        const dak = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4.5, 16), dakMat);
        dak.position.set(tx, 16.2, tz);
        scene.add(toren, dak);
        voegObstakel(toren);
      }
      // Centrale toren
      const midToren = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 20, 16), muurMat);
      midToren.position.set(0, 10, (FACADE_Z + ACHTER_Z) / 2);
      const midDak = new THREE.Mesh(new THREE.ConeGeometry(5.2, 6, 16), dakMat);
      midDak.position.set(0, 23, (FACADE_Z + ACHTER_Z) / 2);
      scene.add(midToren, midDak);

      /* Buitenmuren van de hal (zij + achter) */
      const zijLengte = Math.abs(ACHTER_Z - FACADE_Z);
      for (const kant of [-1, 1]) {
        const muur = new THREE.Mesh(
          new THREE.BoxGeometry(MUURDIKTE, 11, zijLengte),
          muurMat
        );
        muur.position.set(kant * (halfB + MUURDIKTE / 2), 5.5, (FACADE_Z + ACHTER_Z) / 2);
        scene.add(muur);
        voegObstakel(muur);
      }
      const achterMuur = new THREE.Mesh(
        new THREE.BoxGeometry(HAL_BREEDTE + 2 * MUURDIKTE, 11, MUURDIKTE),
        muurMat
      );
      achterMuur.position.set(0, 5.5, ACHTER_Z - MUURDIKTE / 2);
      scene.add(achterMuur);
      voegObstakel(achterMuur);

      /* Binnenkant: aparte lichte wandvlakken zodat binnen niet dezelfde steen heeft */
      const binnenWanden: { pos: THREE.Vector3; rotY: number; breedte: number; hoogte?: number }[] = [
        { pos: new THREE.Vector3(-halfB + 0.02, HAL_HOOGTE / 2, (FACADE_Z + ACHTER_Z) / 2), rotY: Math.PI / 2, breedte: zijLengte },
        { pos: new THREE.Vector3(halfB - 0.02, HAL_HOOGTE / 2, (FACADE_Z + ACHTER_Z) / 2), rotY: -Math.PI / 2, breedte: zijLengte },
        { pos: new THREE.Vector3(0, HAL_HOOGTE / 2, ACHTER_Z + 0.02), rotY: 0, breedte: HAL_BREEDTE },
      ];
      // Voorwand binnen: twee delen naast de deuropening
      const voorSegB = (HAL_BREEDTE - DEUR_BREEDTE) / 2;
      for (const kant of [-1, 1]) {
        binnenWanden.push({
          pos: new THREE.Vector3(
            kant * (DEUR_BREEDTE / 2 + voorSegB / 2),
            HAL_HOOGTE / 2,
            FACADE_Z - MUURDIKTE - 0.02
          ),
          rotY: Math.PI,
          breedte: voorSegB,
        });
      }
      // Deel boven de deuropening
      binnenWanden.push({
        pos: new THREE.Vector3(0, DEUR_HOOGTE + (HAL_HOOGTE - DEUR_HOOGTE) / 2, FACADE_Z - MUURDIKTE - 0.02),
        rotY: Math.PI,
        breedte: DEUR_BREEDTE,
        hoogte: HAL_HOOGTE - DEUR_HOOGTE,
      });
      for (const w of binnenWanden) {
        const vlak = new THREE.Mesh(new THREE.PlaneGeometry(w.breedte, w.hoogte ?? HAL_HOOGTE), binnenMuurMat);
        vlak.position.copy(w.pos);
        vlak.rotation.y = w.rotY;
        scene.add(vlak);
      }

      /* Vloer, plafond en rode loper */
      const schaakTex = maakSchaakbordTexture();
      schaakTex.repeat.set(HAL_BREEDTE / 8, zijLengte / 8);
      const vloer = new THREE.Mesh(
        new THREE.PlaneGeometry(HAL_BREEDTE, zijLengte),
        new THREE.MeshLambertMaterial({ map: schaakTex })
      );
      vloer.rotation.x = -Math.PI / 2;
      vloer.position.set(0, 0.02, (FACADE_Z + ACHTER_Z) / 2);
      scene.add(vloer);

      const loper = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, zijLengte - 4),
        new THREE.MeshLambertMaterial({ color: 0x9c1f2e })
      );
      loper.rotation.x = -Math.PI / 2;
      loper.position.set(0, 0.03, (FACADE_Z + ACHTER_Z) / 2);
      scene.add(loper);

      const plafond = new THREE.Mesh(
        new THREE.PlaneGeometry(HAL_BREEDTE, zijLengte),
        new THREE.MeshLambertMaterial({ color: 0xe6dcc8 })
      );
      plafond.rotation.x = Math.PI / 2;
      plafond.position.set(0, HAL_HOOGTE, (FACADE_Z + ACHTER_Z) / 2);
      scene.add(plafond);

      /* Binnenverlichting */
      const aantalLampen = Math.ceil(zijLengte / 12);
      for (let i = 0; i < aantalLampen; i++) {
        const lz = FACADE_Z - MUURDIKTE - (i + 0.5) * (zijLengte / aantalLampen);
        const lamp = new THREE.PointLight(0xffe6b8, 30, 30, 1.8);
        lamp.position.set(0, HAL_HOOGTE - 1.2, lz);
        scene.add(lamp);
        const bol = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xfff2cc })
        );
        bol.position.copy(lamp.position);
        scene.add(bol);
      }

      /* Slots berekenen en schilderijen ophangen */
      type Slot = { pos: THREE.Vector3; rotY: number };
      const slots: Slot[] = [];
      const binnenVoorZ = FACADE_Z - MUURDIKTE;

      // Zijwanden (afwisselend links/rechts zodat het gelijk vult)
      for (let i = 0; i < perZijkant; i++) {
        const z = binnenVoorZ - 5 - i * SPATIE;
        slots.push({ pos: new THREE.Vector3(-halfB + 0.15, OOG_Y, z), rotY: Math.PI / 2 });
        slots.push({ pos: new THREE.Vector3(halfB - 0.15, OOG_Y, z), rotY: -Math.PI / 2 });
      }
      // Achterwand
      for (let i = 0; i < achterSlots; i++) {
        const x = (i - (achterSlots - 1) / 2) * SPATIE;
        slots.push({ pos: new THREE.Vector3(x, OOG_Y, ACHTER_Z + 0.15), rotY: 0 });
      }
      // Naast de deur (binnenkant gevel)
      for (const kant of [-1, 1]) {
        for (let i = 0; i < voorSlotsPerKant; i++) {
          const x = kant * (DEUR_BREEDTE / 2 + 2.4 + i * SPATIE);
          if (Math.abs(x) > halfB - 1.8) continue;
          slots.push({ pos: new THREE.Vector3(x, OOG_Y, binnenVoorZ - 0.15), rotY: Math.PI });
        }
      }

      werken.slice(0, slots.length).forEach((werk, i) => {
        const slot = slots[i];
        const schilderij = maakSchilderij(werk, i, gebruikPlaatshouder);
        schilderij.position.copy(slot.pos);
        schilderij.rotation.y = slot.rotY;
        scene.add(schilderij);
      });
    }

    fetch("/api/kunstwerken")
      .then((r) => r.json())
      .then((data: { werken?: Kunstwerk[] }) => {
        if (gestopt) return;
        const werken = data.werken ?? [];
        if (werken.length === 0) {
          const plaatshouders = Array.from({ length: 12 }, (_, i) => ({
            titel: `Kunstwerk ${i + 1}`,
            url: "",
          }));
          bouwKasteel(plaatshouders, true);
          setFallback(true);
          setAantal(0);
        } else {
          bouwKasteel(werken, false);
          setAantal(werken.length);
        }
        setLaden(false);
      })
      .catch(() => {
        if (gestopt) return;
        const plaatshouders = Array.from({ length: 12 }, (_, i) => ({
          titel: `Kunstwerk ${i + 1}`,
          url: "",
        }));
        bouwKasteel(plaatshouders, true);
        setFallback(true);
        setAantal(0);
        setLaden(false);
      });

    /* --- Besturing --- */
    const speler = new THREE.Vector3(0, 1.7, 12);
    let yaw = 0; // kijkt richting het kasteel (negatieve z)
    let pitch = 0;
    const ingedrukt = new Set<string>();
    const SPELER_RADIUS = 0.45;

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      ingedrukt.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => ingedrukt.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onClick = () => {
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= e.movementX * 0.0022;
      pitch -= e.movementY * 0.0022;
      pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
    };
    document.addEventListener("mousemove", onMouseMove);

    function botst(x: number, z: number): boolean {
      for (const box of obstakels) {
        if (
          x + SPELER_RADIUS > box.min.x &&
          x - SPELER_RADIUS < box.max.x &&
          z + SPELER_RADIUS > box.min.z &&
          z - SPELER_RADIUS < box.max.z &&
          box.min.y < 2 // alleen obstakels op loophoogte
        ) {
          return true;
        }
      }
      return false;
    }

    /* --- Kijk-detectie voor titels --- */
    const raycaster = new THREE.Raycaster();
    let laatsteRaycast = 0;

    /* --- Render-lus --- */
    const klok = new THREE.Clock();
    function animate() {
      if (gestopt) return;
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(klok.getDelta(), 0.05);

      const draaiSnelheid = 2.1;
      if (ingedrukt.has("ArrowLeft")) yaw += draaiSnelheid * dt;
      if (ingedrukt.has("ArrowRight")) yaw -= draaiSnelheid * dt;

      const snelheid = ingedrukt.has("ShiftLeft") || ingedrukt.has("ShiftRight") ? 9 : 5;
      let voor = 0;
      let zij = 0;
      if (ingedrukt.has("ArrowUp") || ingedrukt.has("KeyW")) voor += 1;
      if (ingedrukt.has("ArrowDown") || ingedrukt.has("KeyS")) voor -= 1;
      if (ingedrukt.has("KeyA")) zij -= 1;
      if (ingedrukt.has("KeyD")) zij += 1;

      if (voor !== 0 || zij !== 0) {
        const lengte = Math.hypot(voor, zij);
        const richtingX = (Math.sin(yaw) * -voor + Math.cos(yaw) * zij) / lengte;
        const richtingZ = (Math.cos(yaw) * -voor - Math.sin(yaw) * zij) / lengte;
        const nx = speler.x + richtingX * snelheid * dt;
        const nz = speler.z + richtingZ * snelheid * dt;
        if (!botst(nx, speler.z)) speler.x = nx;
        if (!botst(speler.x, nz)) speler.z = nz;
      }

      camera.position.copy(speler);
      camera.rotation.set(pitch, yaw, 0);

      // Elke ~200 ms kijken of we naar een schilderij kijken
      const nu = performance.now();
      if (nu - laatsteRaycast > 200 && schilderijMeshes.length > 0) {
        laatsteRaycast = nu;
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const hits = raycaster.intersectObjects(schilderijMeshes, false);
        if (hits.length > 0 && hits[0].distance < 9) {
          setHuidigeTitel(hits[0].object.userData.titel as string);
        } else {
          setHuidigeTitel(null);
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    /* --- Resize --- */
    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      gestopt = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("click", onClick);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <div ref={containerRef} className="w-full h-full" />

      {laden && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-20">
          <div className="text-2xl font-bold mb-2">🏰 Kasteel wordt gebouwd…</div>
          <div className="text-sm opacity-70">Kunstwerken van mindofmaxi.com worden opgehaald</div>
        </div>
      )}

      {/* Instructies */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/60 text-white text-sm rounded-xl px-4 py-3 leading-relaxed pointer-events-none">
        <div><strong>↑ ↓</strong> lopen &nbsp; <strong>← →</strong> draaien</div>
        <div><strong>W A S D</strong> lopen &nbsp; <strong>Shift</strong> rennen</div>
        <div><strong>Klik</strong> voor muisbesturing &nbsp; <strong>Esc</strong> om los te laten</div>
      </div>

      {/* Status rechtsboven */}
      <div className="absolute top-4 right-4 z-10 bg-black/60 text-white text-sm rounded-xl px-4 py-2 pointer-events-none">
        {fallback
          ? "⚠️ mindofmaxi.com niet bereikbaar – plaatshouders getoond"
          : aantal !== null
            ? `🖼️ ${aantal} kunstwerken van mindofmaxi.com`
            : ""}
      </div>

      {/* Titel van het schilderij waar je naar kijkt */}
      {huidigeTitel && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white text-lg font-semibold rounded-xl px-6 py-3 pointer-events-none">
          {huidigeTitel}
        </div>
      )}

      {/* Richtkruis */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-1.5 h-1.5 rounded-full bg-white/70 pointer-events-none" />
    </div>
  );
}
