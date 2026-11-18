// Ropa, accesorios y color automático del disfraz de mono.
Walter.conectarRopa = function(model, state) {
  const panel = document.querySelector('#custom-clothes');
  if (!panel || !model.groups || !model.arms) return;
  if (panel.querySelector('#walter-wardrobe')) return;

  const selected = { head: 'none', body: 'none', extra: 'none' };
  const catalog = { head: {}, body: {}, extra: {} };
  let coloresAntesDelMono = null;
  const COLOR_MONO = '#8b522e';

  const material = color => new THREE.MeshStandardMaterial({
    color, roughness: 0.88, metalness: 0, side: THREE.DoubleSide
  });

  const mats = {
    straw: material('#b88e52'),
    ribbon: material('#28272b'),
    brown: material(COLOR_MONO),
    tan: material('#c99a6b'),
    yellow: material('#f5c928'),
    navy: material('#142543'),
    black: material('#202126')
  };

  function createGroup(category, id, parent) {
    const group = new THREE.Group();
    group.visible = false;
    group.userData.clothing = true;
    parent.add(group);
    (catalog[category][id] ||= []).push(group);
    return group;
  }

  function addMesh(parent, geometry, mat, position, label, part) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(...position);
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData = { clothing: true, label, part };
    parent.add(object);
    model.interactive.push(object);
    return object;
  }

  function cylinder(parent, top, bottom, height, mat, position, label, part) {
    return addMesh(
      parent,
      new THREE.CylinderGeometry(top, bottom, height, 64),
      mat, position, label, part
    );
  }

  function sphere(parent, radius, mat, position, scale, label, part) {
    const object = addMesh(
      parent, new THREE.SphereGeometry(radius, 40, 28),
      mat, position, label, part
    );
    object.scale.set(...scale);
    return object;
  }

  function torus(parent, radius, tube, mat, position, label, part) {
    const object = addMesh(
      parent, new THREE.TorusGeometry(radius, tube, 12, 80),
      mat, position, label, part
    );
    object.rotation.x = Math.PI / 2;
    return object;
  }

  function findOriginal(label) {
    return model.interactive.find(object =>
      !object.userData.clothing && object.userData.label === label
    );
  }

  // Sombrero de paja.
  const hat = createGroup('head', 'straw', model.groups.head);
  const brim = cylinder(
    hat, 1.02, 1.02, 0.055, mats.straw,
    [0, 2.44, 0], 'Ala del sombrero', 'head'
  );
  brim.scale.z = 0.70;

  const crown = cylinder(
    hat, 0.59, 0.73, 0.43, mats.straw,
    [0, 2.68, 0], 'Copa del sombrero', 'head'
  );
  crown.scale.z = 0.72;

  const band = cylinder(
    hat, 0.707, 0.735, 0.09, mats.ribbon,
    [0, 2.50, 0], 'Cinta del sombrero', 'head'
  );
  band.scale.z = 0.72;

  [0.80, 0.90, 1.00].forEach(radius => {
    const ring = torus(
      hat, radius, 0.009, mats.straw,
      [0, 2.472, 0], 'Tejido del sombrero', 'head'
    );
    ring.scale.y = 0.70;
  });

  // Gorrito de mono con orejas.
  const monkeyHat = createGroup('head', 'monkey', model.groups.head);
  const cap = addMesh(
    monkeyHat,
    new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    mats.brown, [0, 2.34, 0], 'Gorrito de mono', 'head'
  );
  cap.scale.set(0.79, 0.32, 0.53);

  [-1, 1].forEach(side => {
    sphere(
      monkeyHat, 1, mats.brown, [side * 0.68, 2.03, 0],
      [0.12, 0.34, 0.46], 'Lateral del gorrito', 'head'
    );
    sphere(
      monkeyHat, 1, mats.brown, [side * 0.88, 1.98, 0],
      [0.24, 0.27, 0.15], 'Oreja del disfraz de mono', 'head'
    );
    sphere(
      monkeyHat, 1, mats.tan, [side * 0.90, 1.98, 0.12],
      [0.15, 0.18, 0.055], 'Interior de la oreja', 'head'
    );
  });

  const shirtProfile = [
    [0.63, -0.93], [0.58, -0.60], [0.56, -0.20],
    [0.61, 0.20], [0.67, 0.45], [0.81, 0.70],
    [0.65, 0.80], [0.45, 0.91], [0.26, 0.98]
  ];

  const longProfile = [
    [0.91, -1.59], [0.87, -1.40], [0.65, -0.90],
    [0.57, -0.20], [0.67, 0.45], [0.81, 0.70],
    [0.65, 0.80], [0.45, 0.91], [0.26, 0.98]
  ];

  // Cada mitad de la ropa acompaña a su cubierta al abrir el torso.
  function createTorsoClothing(id, profile, mat, label) {
    const front = findOriginal('Cubierta frontal del torso');
    const back = findOriginal('Cubierta posterior del torso');

    if (front && back) {
      [front, back].forEach((shell, index) => {
        const group = createGroup('body', id, shell.parent);
        const parameters = shell.geometry.parameters || {};
        const start = parameters.phiStart ?? index * Math.PI;
        const length = parameters.phiLength ?? Math.PI;
        const geometry = new THREE.LatheGeometry(
          profile.map(([r, y]) => new THREE.Vector2(r, y)),
          64, start, length
        );
        const cloth = addMesh(
          group, geometry, mat, [0, 0, 0], label, 'body'
        );
        cloth.position.copy(shell.position);
        cloth.quaternion.copy(shell.quaternion);
        cloth.scale.copy(shell.scale);
      });
    } else {
      const group = createGroup('body', id, model.groups.body);
      const cloth = addMesh(
        group,
        new THREE.LatheGeometry(
          profile.map(([r, y]) => new THREE.Vector2(r, y)), 96
        ),
        mat, [0, 0, 0], label, 'body'
      );
      cloth.scale.z = 0.85;
    }
  }

  // Las mangas siguen al hombro durante el saludo.
  function createSleeves(id, mat, trim) {
    model.arms.forEach(arm => {
      if (!arm.shoulder) return;

      const cover = arm.shoulder.children.find(child =>
        child.children.some(object =>
          object.userData.label === 'Cubierta del brazo'
        )
      );

      const group = createGroup('body', id, cover || arm.shoulder);
      cylinder(
        group, 0.205, 0.19, 0.43, mat,
        [0, -0.27, 0], 'Manga de la ropa', 'arms'
      );
      cylinder(
        group, 0.195, 0.195, 0.055, trim,
        [0, -0.48, 0], 'Borde de la manga', 'arms'
      );
    });
  }

  createTorsoClothing('ecuador', shirtProfile, mats.yellow, 'Camiseta amarilla');
  createSleeves('ecuador', mats.yellow, mats.navy);

  createTorsoClothing('black', longProfile, mats.black, 'Traje negro');
  createSleeves('black', mats.black, mats.black);

  createTorsoClothing('monkey', longProfile, mats.brown, 'Traje de mono');
  createSleeves('monkey', mats.brown, mats.brown);

  // Pañuelo alrededor del cuello.
  const scarf = createGroup('extra', 'scarf', model.groups.body);
  const neck = torus(
    scarf, 0.28, 0.085, mats.black,
    [0, 1.035, 0], 'Pañuelo del cuello', 'body'
  );
  neck.scale.y = 0.85;

  sphere(
    scarf, 1, mats.black, [0, 0.87, 0.43],
    [0.12, 0.12, 0.085], 'Nudo del pañuelo', 'body'
  );

  function ribbon(points, label) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points.flat(), 3)
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
    geometry.computeVertexNormals();
    addMesh(scarf, geometry, mats.black, [0, 0, 0], label, 'body');
  }

  ribbon([
    [-0.07, 0.86, 0.48], [0.10, 0.85, 0.48],
    [0.14, 0.12, 0.58], [-0.08, 0.13, 0.58],
    [0.12, -0.08, 0.59]
  ], 'Extremo del pañuelo');

  ribbon([
    [-0.10, 0.84, 0.47], [0.04, 0.86, 0.48],
    [-0.03, 0.31, 0.59], [-0.20, 0.27, 0.59],
    [-0.17, 0.10, 0.59]
  ], 'Segundo extremo del pañuelo');

  // Interfaz: se añade dentro de Ropa y accesorios.
  const wardrobe = document.createElement('div');
  wardrobe.id = 'walter-wardrobe';
  wardrobe.innerHTML = `
    <p class="wardrobe-description">
      Elige un conjunto o combina sus accesorios.
    </p>
    <div class="wardrobe-presets" role="group" aria-label="Conjuntos">
      <button type="button" data-outfit="straw" aria-pressed="false">
        <strong>Sombrero y pañuelo</strong>
        <span>Sombrero de paja con pañuelo negro.</span>
      </button>
      <button type="button" data-outfit="ecuador" aria-pressed="false">
        <strong>Ecuador</strong>
        <span>Camiseta amarilla con mangas azules.</span>
      </button>
      <button type="button" data-outfit="monkey" aria-pressed="false">
        <strong>Disfraz de mono</strong>
        <span>Gorrito, traje y color café automático.</span>
      </button>
    </div>
    <div class="wardrobe-fields">
      <label>
        <span>Cabeza</span>
        <select data-clothing="head">
          <option value="none">Sin accesorio</option>
          <option value="straw">Sombrero de paja</option>
          <option value="monkey">Gorrito de mono</option>
        </select>
      </label>
      <label>
        <span>Ropa</span>
        <select data-clothing="body">
          <option value="none">Sin ropa</option>
          <option value="ecuador">Camiseta de Ecuador</option>
          <option value="black">Traje negro</option>
          <option value="monkey">Traje de mono</option>
        </select>
      </label>
      <label>
        <span>Complementos</span>
        <select data-clothing="extra">
          <option value="none">Sin complemento</option>
          <option value="scarf">Pañuelo negro</option>
        </select>
      </label>
    </div>
    <button id="remove-clothes" type="button">Quitar ropa y accesorios</button>
    <p id="wardrobe-status" role="status" aria-live="polite"></p>
  `;
  panel.appendChild(wardrobe);

  const presets = {
    straw: { head: 'straw', body: 'none', extra: 'scarf' },
    ecuador: { head: 'none', body: 'ecuador', extra: 'none' },
    monkey: { head: 'monkey', body: 'monkey', extra: 'none' }
  };

  function obtenerSelector(zona) {
    return document.querySelector(
      `#custom-options [data-zone="${zona}"] input[type="color"]`
    );
  }

  function pintar(zona, color) {
    const input = obtenerSelector(zona);
    if (!input) return;
    input.value = color;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function actualizarColorMono() {
    const llevaMono = selected.head === 'monkey';
    const zonas = ['head', 'body', 'arms'];

    if (llevaMono && !coloresAntesDelMono) {
      const anteriores = {};
      zonas.forEach(zona => {
        const input = obtenerSelector(zona);
        if (input) anteriores[zona] = input.value;
      });

      if (!Object.keys(anteriores).length) return;
      coloresAntesDelMono = anteriores;
      Object.keys(anteriores).forEach(zona => pintar(zona, COLOR_MONO));
    } else if (!llevaMono && coloresAntesDelMono) {
      Object.entries(coloresAntesDelMono).forEach(([zona, color]) => {
        pintar(zona, color);
      });
      coloresAntesDelMono = null;
    }
  }

  function refresh() {
    actualizarColorMono();

    Object.entries(catalog).forEach(([category, items]) => {
      Object.entries(items).forEach(([id, groups]) => {
        groups.forEach(group => {
          group.visible = selected[category] === id;
        });
      });
    });

    wardrobe.querySelectorAll('[data-clothing]').forEach(select => {
      select.value = selected[select.dataset.clothing];
    });

    wardrobe.querySelectorAll('[data-outfit]').forEach(button => {
      const preset = presets[button.dataset.outfit];
      const active = Object.keys(selected).every(key =>
        selected[key] === preset[key]
      );
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function actualizarRostro() {
    if (typeof model.setExpression !== 'function') return;
    model.setExpression(selected.head === 'monkey' ? 'monkey' : 'normal');
  }

  wardrobe.querySelectorAll('[data-outfit]').forEach(button => {
    button.addEventListener('click', () => {
      Object.assign(selected, presets[button.dataset.outfit]);
      refresh();
      actualizarRostro();
      wardrobe.querySelector('#wardrobe-status').textContent =
        `${button.querySelector('strong').textContent} seleccionado.`;
    });
  });

  wardrobe.querySelectorAll('[data-clothing]').forEach(select => {
    select.addEventListener('change', () => {
      const category = select.dataset.clothing;
      selected[category] = select.value;
      refresh();
      if (category === 'head') actualizarRostro();
      wardrobe.querySelector('#wardrobe-status').textContent =
        'Accesorios actualizados.';
    });
  });

  wardrobe.querySelector('#remove-clothes').addEventListener('click', () => {
    Object.assign(selected, { head: 'none', body: 'none', extra: 'none' });
    refresh();
    actualizarRostro();
    wardrobe.querySelector('#wardrobe-status').textContent =
      'Ropa y accesorios retirados.';
  });

  // Estilos limitados a este apartado.
  let style = document.querySelector('#walter-wardrobe-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'walter-wardrobe-style';
    document.head.appendChild(style);
  }

  style.textContent = `
    #walter-wardrobe {
      color: #eaf3fc;
      font-size: 16px;
    }
    #walter-wardrobe .wardrobe-description {
      margin: 12px 0 18px;
      color: #adc1d1;
      line-height: 1.6;
    }
    #walter-wardrobe .wardrobe-presets {
      display: grid;
      gap: 10px;
    }
    #walter-wardrobe .wardrobe-presets button {
      display: grid;
      gap: 6px;
      width: 100%;
      min-height: 78px;
      padding: 16px;
      border: 1px solid #36586c;
      border-radius: 12px;
      background: #172f40;
      color: #eaf3fc;
      text-align: left;
      font: inherit;
      cursor: pointer;
      touch-action: manipulation;
    }
    #walter-wardrobe .wardrobe-presets strong {
      font-size: 17px;
    }
    #walter-wardrobe .wardrobe-presets button span {
      color: #adc1d1;
      font-size: 14px;
      line-height: 1.5;
    }
    #walter-wardrobe .wardrobe-presets button[aria-pressed="true"] {
      border-color: #65cfff;
      background: #203e51;
      box-shadow: inset 3px 0 #65cfff;
    }
    #walter-wardrobe .wardrobe-fields {
      display: grid;
      gap: 16px;
      margin: 22px 0;
    }
    #walter-wardrobe .wardrobe-fields label {
      display: grid;
      gap: 8px;
      font-weight: 600;
    }
    #walter-wardrobe select {
      width: 100%;
      min-height: 48px;
      padding: 10px 12px;
      border: 1px solid #36586c;
      border-radius: 10px;
      background: #142a39;
      color: #eaf3fc;
      font: inherit;
      color-scheme: dark;
    }
    #walter-wardrobe #remove-clothes {
      width: 100%;
      min-height: 48px;
      padding: 12px;
      border: 1px solid #41677e;
      border-radius: 10px;
      background: #1b3548;
      color: #eaf3fc;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      touch-action: manipulation;
    }
    #walter-wardrobe button:focus-visible,
    #walter-wardrobe select:focus-visible {
      outline: 2px solid #65cfff;
      outline-offset: 3px;
    }
    #walter-wardrobe #wardrobe-status {
      min-height: 20px;
      margin: 12px 0 0;
      color: #adc1d1;
      font-size: 14px;
      line-height: 1.5;
    }
  `;

  refresh();
};