// Cuatro secciones; las cubiertas se abren sin alterar sus posiciones originales.
Walter.crearModelo = function(scene) {
  const robot = new THREE.Group(), content = new THREE.Group();
  scene.add(robot); robot.add(content);
  const groups = {}, interactive = [], moving = [];
  const mat = (color, metalness = .15) => new THREE.MeshStandardMaterial({color, roughness: .48, metalness});
  const white = mat(0xecece7), black = mat(0x20282d), blue = mat(0x285ead);
  const metal = mat(0x9da6aa, .75), green = mat(0x245e45), wood = mat(0x9b805e);
  const red = mat(0xb63c35), wire = mat(0x252528);
  const eye = mat(0x50b8ef); eye.emissive.set(0x238bc7); eye.emissiveIntensity = .6;
  for (const part of ['head', 'body', 'arms', 'base']) {
    const g = new THREE.Group(); g.userData.part = part;
    groups[part] = g; content.add(g);
  }
  function subgroup(parent, delta) {
    const g = new THREE.Group(); parent.add(g);
    if (delta) moving.push({group: g, delta: new THREE.Vector3(...delta)});
    return g;
  }
  function mesh(parent, geometry, material, x, y, z, label) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    let root = parent;
    while (!root.userData.part) root = root.parent;
    m.userData = {part: root.userData.part, label};
    parent.add(m); interactive.push(m); return m;
  }
  const box = (g, w, h, d, m, x, y, z, label) => mesh(g, new THREE.BoxGeometry(w, h, d), m, x, y, z, label);
  const cyl = (g, r, h, m, x, y, z, label) => mesh(g, new THREE.CylinderGeometry(r, r, h, 40), m, x, y, z, label);
  function round(g, w, h, d, r, m, x, y, z, label) {
    const s = new THREE.Shape(), a = w / 2, b = h / 2;
    s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.quadraticCurveTo(a, -b, a, -b + r);
    s.lineTo(a, b - r); s.quadraticCurveTo(a, b, a - r, b);
    s.lineTo(-a + r, b); s.quadraticCurveTo(-a, b, -a, b - r);
    s.lineTo(-a, -b + r); s.quadraticCurveTo(-a, -b, -a + r, -b);
    const geo = new THREE.ExtrudeGeometry(s, {depth: d, bevelEnabled: false, curveSegments: 12});
    geo.translate(0, 0, -d / 2);
    return mesh(g, geo, m, x, y, z, label);
  }
  function cable(g, points, material = red) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(g, new THREE.TubeGeometry(curve, 20, .018, 6, false), material, 0, 0, 0, 'Cableado ilustrativo');
  }
  function board(g, x, y, z, w = .42, d = .30) {
    box(g, w, .035, d, green, x, y, z, 'Placa electrónica simplificada');
    box(g, w * .35, .05, d * .4, black, x, y + .04, z, 'Componente electrónico');
    for (let i = 0; i < 4; i++) box(g, .045, .055, .06, metal, x - w / 2 + .06 + i * .07, y + .04, z + d / 2 - .04, 'Conector');
  }
  function servo(g, x, y, z) {
    box(g, .22, .28, .22, black, x, y, z, 'Servomotor representado');
    const disc = cyl(g, .12, .055, blue, x, y, z + .14, 'Disco de articulación');
    disc.rotation.x = Math.PI / 2;
    const screw = cyl(g, .035, .06, metal, x, y, z + .18, 'Eje de articulación');
    screw.rotation.x = Math.PI / 2;
  }

  // CABEZA: marco, frontal y tapa posterior separados; interior accesible.
  const head = groups.head, face = subgroup(head, [0, 0, .7]), back = subgroup(head, [0, 0, -.65]);
  round(head, 1.35, .17, .70, .07, white, 0, 2.31, 0, 'Marco superior');
  round(head, 1.35, .17, .70, .07, white, 0, 1.24, 0, 'Marco inferior');
  for (const side of [-1, 1]) {
    round(head, .17, .98, .70, .07, white, side * .60, 1.78, 0, 'Lateral de la cabeza');
    for (let i = 0; i < 5; i++) box(head, .012, .035, .26, black, side * .69, 1.55 + i * .09, -.03, 'Rejilla lateral');
  }
  round(face, 1.18, 1.06, .07, .24, white, 0, 1.78, .38, 'Cubierta frontal');
  round(face, 1.03, .60, .025, .18, black, 0, 1.67, .43, 'Pantalla facial');
  for (const x of [-.25, .25]) {
    const e = mesh(face, new THREE.SphereGeometry(.13, 24, 16), eye, x, 1.72, .455, 'Ojo de la pantalla');
    e.scale.z = .16;
  }
  const smile = cable(face, [[-.24, 1.51, .46], [0, 1.43, .46], [.24, 1.51, .46]], eye);
  smile.userData.label = 'Expresión de la pantalla';
  const lens = cyl(face, .09, .09, black, 0, 2.12, .46, 'Cámara frontal representada');
  lens.rotation.x = Math.PI / 2;
  round(back, 1.18, 1.06, .08, .24, white, 0, 1.78, -.39, 'Tapa posterior');
  for (let i = 0; i < 7; i++) box(back, .48, .025, .008, black, 0, 1.52 + i * .07, -.435, 'Ventilación posterior');
  box(head, .78, .42, .09, green, 0, 1.72, .05, 'Electrónica de cabeza: distribución aproximada');
  servo(head, 0, 1.10, 0);
  for (const x of [-.20, .20]) box(head, .065, .35, .28, metal, x, 1.13, 0, 'Soporte del cuello');
  cable(head, [[.12, 1, -.12], [.26, 1.35, -.16], [.18, 1.72, -.10]]);

  // CUERPO: dos medias cubiertas; estructura y componentes dentro.
  const body = groups.body;
  const profile = [
    [.86, -1.58], [.82, -1.4], [.60, -.9], [.52, -.2],
    [.62, .45], [.76, .70], [.40, .90], [.20, .96]
  ].map(p => new THREE.Vector2(...p));
  for (const side of [1, -1]) {
    const shell = subgroup(body, [0, 0, side * .85]);
    const g = new THREE.LatheGeometry(profile, 40, side === 1 ? -Math.PI / 2 : Math.PI / 2, Math.PI);
    const skin = white.clone(); skin.side = THREE.DoubleSide;
    const cover = mesh(shell, g, skin, 0, 0, 0, side === 1 ? 'Cubierta frontal del torso' : 'Cubierta posterior del torso');
    cover.scale.z = .85;
  }
  box(body, .16, 2.35, .18, black, 0, -.25, -.15, 'Columna central');
  for (const y of [-1.32, -.70, .45]) box(body, .9, .065, .62, metal, 0, y, 0, 'Plataforma estructural');
  for (const x of [-.32, .32]) box(body, .055, 1.90, .055, metal, x, -.35, -.19, 'Soporte vertical');
  for (const x of [-.29, 0, .29]) servo(body, x, .57, .03);
  box(body, .53, .24, .43, black, 0, -1.15, 0, 'Mini PC: representación visual');
  for (let i = 0; i < 6; i++) box(body, .035, .012, .29, metal, -.18 + i * .07, -1.023, 0, 'Rejilla del equipo');
  board(body, 0, -.66, .08);
  const fan = cyl(body, .16, .06, black, .20, -.93, .26, 'Ventilador representado');
  fan.rotation.x = Math.PI / 2;
  cable(body, [[-.25, .65, -.05], [-.38, 0, .04], [-.26, -1.1, .22]]);
  cable(body, [[.25, .50, -.12], [.35, -.3, -.10], [.18, -1.2, .18]], wire);

    // BRAZOS: soporte fijo y articulaciones independientes.
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = subgroup(groups.arms);
    const x = side * 1.02;

    // El soporte y el motor del hombro no giran con el brazo.
    box(arm, .35, .07, .20, metal, side * .87, .65, 0, 'Soporte del hombro');
    servo(arm, x, .64, 0);

    const shoulder = subgroup(arm);
    shoulder.position.set(x, .64, 0);
    const upperCover = subgroup(shoulder, [side * .42, 0, .30]);

    box(shoulder, .09, .57, .10, metal, 0, -.42, 0, 'Estructura del brazo');
    round(upperCover, .26, .51, .25, .09, white, 0, -.42, .03, 'Cubierta del brazo');
    servo(shoulder, 0, -.81, 0);

    // El antebrazo gira desde el codo.
    const elbow = subgroup(shoulder);
    elbow.position.set(0, -.81, 0);
    const foreCover = subgroup(elbow, [side * .42, 0, .30]);

    box(elbow, .07, .60, .09, metal, 0, -.44, 0, 'Estructura del antebrazo');
    round(foreCover, .22, .55, .22, .08, white, 0, -.43, .03, 'Cubierta del antebrazo');

    // La mano gira desde la muñeca.
    const wrist = subgroup(elbow);
    wrist.position.set(0, -.73, 0);
    round(wrist, .22, .24, .12, .07, white, 0, -.11, .02, 'Palma');
    for (let i = 0; i < 4; i++) {
      cyl(wrist, .024, .18, white, (i - 1.5) * .05, -.30, .02, 'Dedo');
    }
    const thumb = cyl(wrist, .03, .16, white, -side * .14, -.15, .02, 'Pulgar');
    thumb.rotation.z = -side * .55;

    // Cableado dividido para acompañar las articulaciones.
    cable(shoulder, [[0, -.02, -.14], [side * .09, -.40, -.15], [0, -.76, -.12]], wire);
    cable(elbow, [[0, -.02, -.12], [side * .07, -.30, -.13], [0, -.65, -.12]], wire);

    arms.push({group:arm, side, shoulder, elbow, wrist});
  }

  // BASE: dos niveles, ruedas laterales y apoyos pequeños proporcionados.
  const base = groups.base, lid = subgroup(base, [0, 1.25, -.45]);
  cyl(base, .94, .08, black, 0, -2.02, 0, 'Chasis inferior');
  cyl(lid, .94, .07, wood, 0, -1.62, 0, 'Plataforma superior');
  for (const x of [-.58, .58]) for (const z of [-.47, .47]) {
    cyl(base, .025, .35, metal, x, -1.82, z, 'Varilla de soporte');
    cyl(base, .05, .025, metal, x, -1.68, z, 'Tuerca');
  }
  for (const side of [-1, 1]) {
    const tire = cyl(base, .245, .17, black, side * .84, -1.97, 0, 'Rueda lateral');
    tire.rotation.z = Math.PI / 2;
    const hub = cyl(base, .12, .18, metal, side * .85, -1.97, 0, 'Centro de rueda');
    hub.rotation.z = Math.PI / 2;
  }
  for (const z of [-.65, .65]) {
    box(base, .10, .09, .10, metal, 0, -2.10, z, 'Soporte de rueda auxiliar');
    const wheel = cyl(base, .075, .07, black, 0, -2.14, z, 'Rueda auxiliar');
    wheel.rotation.z = Math.PI / 2;
  }
  board(base, -.35, -1.94, .28, .34, .28);
  board(base, .30, -1.94, -.30);
  box(base, .30, .13, .30, metal, .28, -1.88, .28, 'Módulo con disipador');
    // Interruptores exteriores: el derecho controla el rostro.
  box(lid, .38, .20, .07, black, 0, -1.82, 1.01, 'Panel exterior de interruptores');
  for (const x of [-.095, .095]) {
    const right = x > 0;
    const frame = box(lid, .105, .135, .025, metal, x, -1.82, 1.055, 'Marco del interruptor');
    const button = box(lid, .075, .10, .04, red.clone(), x, -1.82, 1.085, right ? 'Encender o apagar rostro' : 'Interruptor');
    if (right) {
      frame.userData.action = 'toggle-face';
      button.userData.action = 'toggle-face';
      button.userData.powerButton = true;
      button.rotation.x = -.15;
    }
  }
  cable(base, [[-.35, -1.89, .28], [0, -1.82, 0], [.3, -1.89, -.3]]);
  cable(base, [[.26, -1.88, .25], [-.12, -1.85, .45], [0, -1.85, .78]], wire);

    // Cubierta negra de la base, abierta por dentro.
  // Se mueve con la plataforma superior al mostrar el interior.
  const coverMaterial = new THREE.MeshStandardMaterial({
    color:0x171b20,
    roughness:.72,
    metalness:.08
  });

  // Perfil con espesor y bordes suavizados.
  const coverProfile = [
    [.955, -2.025],
    [.985, -2.015],
    [1.000, -1.990],
    [1.000, -1.635],
    [.985, -1.605],
    [.955, -1.595],
    [.940, -1.610],
    [.965, -1.640],
    [.965, -1.985],
    [.940, -2.010],
    [.955, -2.025]
  ].map(([radius, height]) => new THREE.Vector2(radius, height));

  const baseCover = mesh(
    lid,
    new THREE.LatheGeometry(coverProfile, 96),
    coverMaterial,
    0, 0, 0,
    'Cubierta protectora de la base'
  );
  baseCover.geometry.computeVertexNormals();

    // Saludo articulado: abre el hombro, dobla el codo y agita la mano.
  let greetingStart = null;
  let greetingStopping = false;
  const greetingPose = {shoulder:0, elbow:0, wrist:0};
  let stopPose = {...greetingPose};

  function smooth(value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function greet() {
    if (greetingStart !== null) return;
    greetingStopping = false;
    greetingStart = performance.now();
  }

  function stopGreeting() {
    if (greetingStart === null || greetingStopping) return;
    stopPose = {...greetingPose};
    greetingStopping = true;
    greetingStart = performance.now();
  }

  function updateGreeting() {
    if (greetingStart === null) return;
    const elapsed = (performance.now() - greetingStart) / 1000;

    if (greetingStopping) {
      const remaining = 1 - smooth(elapsed / .45);
      greetingPose.shoulder = stopPose.shoulder * remaining;
      greetingPose.elbow = stopPose.elbow * remaining;
      greetingPose.wrist = stopPose.wrist * remaining;
      if (elapsed >= .45) {
        greetingStart = null;
        greetingStopping = false;
      }
      return;
    }

    let lift = 0, wave = 0;
    if (elapsed < .8) {
      lift = smooth(elapsed / .8);
    } else if (elapsed < 2.4) {
      lift = 1;
      const t = (elapsed - .8) / 1.6;
      wave = Math.sin(t * Math.PI * 6) * Math.sin(t * Math.PI);
    } else if (elapsed < 3.2) {
      lift = 1 - smooth((elapsed - 2.4) / .8);
    } else {
      greetingStart = null;
    }

    greetingPose.shoulder = .65 * lift;
    greetingPose.elbow = 1.95 * lift + .08 * wave;
    greetingPose.wrist = .16 * lift + .25 * wave;
  }

  function pose(amount, interior) {
    updateGreeting();

    groups.head.position.y = interior ? 0 : amount * 1.05;
    groups.base.position.y = interior ? 0 : -amount * .65;

    arms.forEach(a => {
      // La separación de secciones es independiente del saludo.
      a.group.position.set(interior ? 0 : a.side * amount * .8, 0, 0);
      a.group.rotation.set(0, 0, 0);

      // Derecho de Walter: izquierda de la pantalla al verlo de frente.
      const waving = a.side === -1;
      a.shoulder.rotation.z = waving ? -greetingPose.shoulder : 0;
      a.elbow.rotation.z = waving ? -greetingPose.elbow : 0;
      a.wrist.rotation.z = waving ? -greetingPose.wrist : 0;
    });

    moving.forEach(a => {
      a.group.position.copy(a.delta).multiplyScalar(interior ? amount : 0);
    });
  }

  // Calcula el espacio ocupado únicamente por las piezas visibles.
  function bounds() {
    const b = new THREE.Box3(); robot.updateMatrixWorld(true);
    content.traverseVisible(o => {
      if (!o.isMesh) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
    return b;
  }
  function frame(part) {
    robot.rotation.set(0, 0, 0); content.position.set(0, 0, 0);
    Object.entries(groups).forEach(([key, g]) => g.visible = part === 'all' || key === part);
    pose(1, part !== 'all');
    const b = bounds(), center = b.getCenter(new THREE.Vector3());
    content.position.copy(center).negate();
    const radius = b.getSize(new THREE.Vector3()).length() / 2;
    pose(0, false); robot.rotation.set(.08, -.35, 0);
    return radius;
  }
  return {robot, groups, interactive, eye, pose, frame, greet, stopGreeting, arms};
};