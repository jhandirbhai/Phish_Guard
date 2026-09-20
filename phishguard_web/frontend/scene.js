/**
 * scene.js -- the 3D background for PhishGuard (Three.js).
 *
 * A glowing shield with a check-mark, orbiting envelopes, red phishing hooks
 * and a drifting particle field. The scene reacts to what the user is doing:
 *   setMood('home' | 'learn' | 'sim' | 'quiz' | 'chat' | 'lab' | 'attack')
 *   flash('good' | 'bad')
 *
 * Safety net: if WebGL or Three.js is unavailable, or anything throws while
 * rendering, initScene() resolves to null / the loop stops and the CSS
 * gradient background takes over. The rest of the site keeps working.
 */

const MOODS = {
  home:   { c1: 0x58a6ff, c2: 0xa371f7, spin: 0.35, hooks: 0.6, x: 1,   y: 0.3,  z: 0,  s: 1.15 },
  learn:  { c1: 0x58a6ff, c2: 0x3fb950, spin: 0.25, hooks: 0.4, x: 1,   y: 0.6,  z: -3, s: 0.8 },
  sim:    { c1: 0xf0b429, c2: 0x58a6ff, spin: 0.3,  hooks: 0.8, x: 1,   y: 0.6,  z: -3, s: 0.8 },
  quiz:   { c1: 0xa371f7, c2: 0x58a6ff, spin: 0.3,  hooks: 0.5, x: 1,   y: 0.6,  z: -3, s: 0.8 },
  chat:   { c1: 0x3fb950, c2: 0x58a6ff, spin: 0.2,  hooks: 0.3, x: 1,   y: 0.6,  z: -3, s: 0.8 },
  lab:    { c1: 0xf85149, c2: 0xf0b429, spin: 0.4,  hooks: 1.2, x: 1,   y: 0.6,  z: -3, s: 0.85 },
  attack: { c1: 0xff2d2d, c2: 0x8b0000, spin: 1.2,  hooks: 2.2, x: 0.3, y: 0.2,  z: -1, s: 1.0, attack: true },
};

export async function initScene(canvas) {
  let THREE;
  try {
    THREE = await import("three");
  } catch (_) {
    try {
      THREE = await import("./vendor/three.module.js"); // optional local copy for offline use
    } catch (__) {
      return null;
    }
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: "high-performance",
    });
  } catch (_) {
    return null;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = reduceMotion ? 0.25 : 1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b12, 0.03);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.AmbientLight(0x8899bb, 0.9));
  const key = new THREE.PointLight(0x58a6ff, 90, 30, 2);
  key.position.set(5, 4, 6);
  const fill = new THREE.PointLight(0xa371f7, 70, 30, 2);
  fill.position.set(-5, -3, 5);
  scene.add(key, fill);

  // ---------------------------------------------------------------- shield
  const hero = new THREE.Group();
  scene.add(hero);

  const shape = new THREE.Shape();
  shape.moveTo(0, 1.3);
  shape.bezierCurveTo(0.35, 1.08, 0.85, 0.98, 1.05, 0.98);
  shape.lineTo(1.05, 0.1);
  shape.bezierCurveTo(1.05, -0.6, 0.6, -1.05, 0, -1.4);
  shape.bezierCurveTo(-0.6, -1.05, -1.05, -0.6, -1.05, 0.1);
  shape.lineTo(-1.05, 0.98);
  shape.bezierCurveTo(-0.85, 0.98, -0.35, 1.08, 0, 1.3);

  const shieldGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.32, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07,
    bevelSegments: 3, curveSegments: 28,
  });
  shieldGeo.center();
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x1b2a45, emissive: 0x58a6ff, emissiveIntensity: 0.25,
    metalness: 0.65, roughness: 0.3,
  });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  hero.add(shield);

  const edgeMat = new THREE.LineBasicMaterial({ color: 0x58a6ff, transparent: true, opacity: 0.9 });
  shield.add(new THREE.LineSegments(new THREE.EdgesGeometry(shieldGeo, 30), edgeMat));

  const checkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.45, -0.02, 0), new THREE.Vector3(-0.12, -0.36, 0), new THREE.Vector3(0.5, 0.4, 0),
  ], false, "catmullrom", 0.05);
  const checkMat = new THREE.MeshStandardMaterial({
    color: 0x3fb950, emissive: 0x3fb950, emissiveIntensity: 0.9, roughness: 0.4,
  });
  const check = new THREE.Mesh(new THREE.TubeGeometry(checkCurve, 24, 0.075, 10, false), checkMat);
  check.position.z = 0.27;
  hero.add(check);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0x58a6ff, transparent: true, opacity: 0.55 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.012, 8, 120), ringMat);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.01, 8, 120), ringMat);
  ring1.rotation.x = Math.PI / 2.4;
  ring2.rotation.x = Math.PI / 1.7;
  ring2.rotation.y = 0.5;
  hero.add(ring1, ring2);

  // ------------------------------------------------------------- envelopes
  const envGeo = new THREE.BoxGeometry(0.7, 0.46, 0.05);
  const flapGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.35, 0.23, 0.03), new THREE.Vector3(0, -0.03, 0.03),
    new THREE.Vector3(0.35, 0.23, 0.03),
  ]);
  const flapMat = new THREE.LineBasicMaterial({ color: 0x8b98ad });
  const envelopes = [];
  const ENV_COUNT = 14;
  for (let i = 0; i < ENV_COUNT; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdfe8f5, emissive: 0x223355, emissiveIntensity: 0.4, roughness: 0.6, metalness: 0.1,
    });
    const mesh = new THREE.Mesh(envGeo, mat);
    mesh.add(new THREE.Line(flapGeo, flapMat));
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.userData = {
      radius: 2.9 + Math.random() * 2.2,
      speed: (0.12 + Math.random() * 0.18) * (Math.random() < 0.5 ? 1 : -1),
      phase: (i / ENV_COUNT) * Math.PI * 2,
      tilt: (Math.random() - 0.5) * 1.6,
      bob: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.2,
      mat,
    };
    envelopes.push(holder);
    hero.add(holder);
  }

  // ----------------------------------------------------------------- hooks
  const hookGeo = new THREE.TorusGeometry(0.22, 0.04, 10, 28, Math.PI * 1.45);
  const hooks = [];
  const HOOK_COUNT = 6;
  for (let i = 0; i < HOOK_COUNT; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf85149, emissive: 0xf85149, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.4,
    });
    const mesh = new THREE.Mesh(hookGeo, mat);
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.userData = {
      radius: 3.4 + Math.random() * 1.6,
      speed: 0.18 + Math.random() * 0.15,
      phase: (i / HOOK_COUNT) * Math.PI * 2 + 0.4,
      lift: (Math.random() - 0.5) * 3,
      mat,
    };
    hooks.push(holder);
    hero.add(holder);
  }

  // ------------------------------------------------------------- particles
  const P = 900;
  const pos = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    const r = 5 + Math.random() * 14;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pos[i * 3 + 2] = r * Math.cos(ph) - 4;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x58a6ff, size: 0.05, transparent: true, opacity: 0.75,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // ------------------------------------------------------------ state/mood
  let mood = MOODS.home;
  const target = { x: 0, y: 0, z: 0, s: 1, spin: 0.3, hooks: 0.6 };
  const cur = { x: 0, y: 0, z: 0, s: 1, spin: 0.3, hooks: 0.6 };
  const c1 = new THREE.Color(MOODS.home.c1);
  const c2 = new THREE.Color(MOODS.home.c2);
  const t1 = new THREE.Color(MOODS.home.c1);
  const t2 = new THREE.Color(MOODS.home.c2);
  const flashColor = new THREE.Color(0xffffff);
  let flashT = 0;
  let aspect = 1;

  function layout() {
    // Wide screens: shield sits to the right, behind the panels. Narrow: top-centre.
    const wide = aspect > 1.15;
    const dir = mood.x;
    target.x = wide ? dir * 3.6 * (mood.attack ? 0.15 : 1) : 0;
    target.y = wide ? mood.y : mood.y + 2.4;
    target.z = wide ? mood.z : mood.z - 1.5;
    target.s = wide ? mood.s : mood.s * 0.7;
  }

  function setMood(name) {
    mood = MOODS[name] || MOODS.home;
    t1.set(mood.c1);
    t2.set(mood.c2);
    target.spin = mood.spin;
    target.hooks = mood.hooks;
    layout();
  }

  function flash(kind) {
    flashColor.set(kind === "good" ? 0x3fb950 : 0xf85149);
    flashT = 1;
  }

  // ---------------------------------------------------------------- resize
  let pixelRatioCap = 2;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    renderer.setSize(w, h, false);
    aspect = w / Math.max(h, 1);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    layout();
  }
  window.addEventListener("resize", resize);
  resize();
  cur.x = target.x; cur.y = target.y; cur.z = target.z; cur.s = target.s;

  // ---------------------------------------------------------------- pointer
  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // ------------------------------------------------------------- main loop
  const clock = new THREE.Clock();
  let running = true;
  let failed = false;
  let frames = 0;
  let slowFrames = 0;
  const tmp = new THREE.Color();

  function frame() {
    if (!running || failed) return;
    requestAnimationFrame(frame);
    try {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const k = 1 - Math.exp(-dt * 2.5);

      // adaptive quality: if the first ~90 frames are slow, drop pixel ratio + particles
      frames++;
      if (frames <= 90) {
        if (dt > 0.03) slowFrames++;
        if (frames === 90 && slowFrames > 45) {
          pixelRatioCap = 1;
          pGeo.setDrawRange(0, P / 2);
          resize();
        }
      }

      for (const key2 of ["x", "y", "z", "s", "spin", "hooks"]) {
        cur[key2] += (target[key2] - cur[key2]) * k;
      }
      c1.lerp(t1, k);
      c2.lerp(t2, k);
      flashT = Math.max(0, flashT - dt * 1.6);

      // hero transform (+ glitchy jitter during the attack mood)
      let jx = 0, jy = 0;
      if (mood.attack && !reduceMotion) {
        jx = (Math.random() - 0.5) * 0.08;
        jy = (Math.random() - 0.5) * 0.08;
      }
      hero.position.set(cur.x + jx, cur.y + Math.sin(t * 0.8 * motion) * 0.12 + jy, cur.z);
      hero.scale.setScalar(cur.s);
      shield.rotation.y = Math.sin(t * 0.5 * motion) * 0.45 * (mood.attack ? 2 : 1);
      shield.rotation.x = Math.sin(t * 0.35 * motion) * 0.08;
      check.rotation.y = shield.rotation.y;
      check.rotation.x = shield.rotation.x;
      hero.rotation.y += dt * cur.spin * 0.15 * motion;
      ring1.rotation.z += dt * 0.25 * cur.spin * 3 * motion;
      ring2.rotation.z -= dt * 0.18 * cur.spin * 3 * motion;

      // colours
      tmp.copy(c1).lerp(flashColor, flashT);
      shieldMat.emissive.copy(tmp);
      shieldMat.emissiveIntensity = 0.25 + flashT * 0.9;
      edgeMat.color.copy(tmp);
      ringMat.color.copy(c2);
      pMat.color.copy(c1);
      key.color.copy(c1);
      fill.color.copy(c2);
      checkMat.color.set(mood.attack ? 0xff2d2d : 0x3fb950);
      checkMat.emissive.set(mood.attack ? 0xff2d2d : 0x3fb950);

      // orbiting envelopes
      for (const e of envelopes) {
        const d = e.userData;
        const a = d.phase + t * d.speed * motion * (1 + cur.spin * 0.6);
        e.position.set(
          Math.cos(a) * d.radius,
          d.tilt + Math.sin(t * 0.7 * motion + d.bob) * 0.35,
          Math.sin(a) * d.radius * 0.6 - 1,
        );
        e.rotation.y = a * 0.5 + t * d.spin * 0.3 * motion;
        e.rotation.z = Math.sin(t * 0.5 + d.bob) * 0.3;
        d.mat.emissive.set(mood.attack ? 0x551111 : 0x223355);
      }

      // hooks dangle around the outside
      for (const h of hooks) {
        const d = h.userData;
        const a = d.phase - t * d.speed * motion * cur.hooks;
        h.position.set(Math.cos(a) * d.radius, d.lift + Math.sin(t * 1.2 * motion + d.phase) * 0.3, Math.sin(a) * d.radius * 0.5);
        h.rotation.z = Math.sin(t * 1.5 * motion + d.phase) * 0.6;
        h.rotation.y = a;
      }

      points.rotation.y += dt * 0.015 * motion;
      points.rotation.x = Math.sin(t * 0.05 * motion) * 0.05;

      // camera parallax
      if (!reduceMotion) {
        camera.position.x += (pointer.x * 0.7 - camera.position.x) * k;
        camera.position.y += (-pointer.y * 0.45 - camera.position.y) * k;
      }
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    } catch (err) {
      failed = true;
      console.warn("PhishGuard: 3D scene stopped, falling back to the CSS background.", err);
      canvas.style.display = "none";
    }
  }

  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); running = false; });
  canvas.addEventListener("webglcontextrestored", () => {
    if (!failed && !running) { running = true; clock.getDelta(); requestAnimationFrame(frame); }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) clock.getDelta(); // swallow the time spent hidden
  });

  setMood("home");
  requestAnimationFrame(frame);
  return { setMood, flash };
}
