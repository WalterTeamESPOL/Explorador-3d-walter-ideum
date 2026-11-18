// Menú de personalización: colores, ropa, rostros, brazos y manos.
Walter.conectarPersonalizacion = function(model) {
  const anchor = document.querySelector('.counter');
  if (!anchor) return;

  const versions = [{id: '2.0', name: 'WALTER VERSION 2.0'}];
  anchor.className = 'version-controls';
  anchor.innerHTML = `
    <div class="version-rail" role="group" aria-label="Versiones de Walter"></div>
    <button id="customize" type="button"
      aria-expanded="false" aria-controls="custom-panel">Personalizar ▾</button>
  `;

  const rail = anchor.querySelector('.version-rail');
  versions.forEach(version => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'version-option';
    button.textContent = version.name;
    button.setAttribute('aria-pressed', 'true');
    button.title = 'Versión actual';
    rail.appendChild(button);
  });

  rail.addEventListener('wheel', event => {
    if (rail.scrollWidth <= rail.clientWidth) return;
    event.preventDefault();
    rail.scrollLeft += event.deltaY || event.deltaX;
  }, {passive: false});

  const panel = document.createElement('section');
  panel.id = 'custom-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'custom-title');
  panel.innerHTML = `
    <div class="custom-heading">
      <div>
        <span class="custom-caption">HAZLO A TU ESTILO</span>
        <h3 id="custom-title" tabindex="-1">Personaliza a Walter</h3>
      </div>
      <button id="custom-close" type="button">Cerrar</button>
    </div>

    <div id="custom-home">
      <p class="muted">¿Qué te gustaría personalizar?</p>
      <div class="custom-menu">
        <button class="custom-choice" id="choose-colors" type="button">
          <span>Cambiar color</span>
          <small>Elige los colores de cada sección.</small>
        </button>
        <button class="custom-choice" id="choose-clothes" type="button">
          <span>Ropa y accesorios</span>
          <small>Prueba conjuntos y combina sus accesorios.</small>
        </button>
        <button class="custom-choice" id="choose-faces" type="button">
          <span>Cambiar rostro</span>
          <small>Normal, feliz, enojado, triste o mono.</small>
        </button>
        <button class="custom-choice" id="choose-arms" type="button">
          <span>Brazos y manos</span>
          <small>Prueba los brazos de la primera versión o el diseño articulado.</small>
        </button>
      </div>
    </div>

    <div id="custom-colors" hidden>
      <button class="custom-return" type="button" data-back="colors">
        ← Volver a opciones
      </button>
      <p class="muted">Elige una zona y prueba sus colores directamente en el modelo.</p>
      <div id="custom-options"></div>
      <button id="custom-reset" type="button">Restaurar apariencia</button>
    </div>

    <div id="custom-clothes" hidden>
      <button class="custom-return" type="button" data-back="clothes">
        ← Volver a opciones
      </button>
    </div>

    <div id="custom-faces" hidden>
      <button class="custom-return" type="button" data-back="faces">
        ← Volver a opciones
      </button>
      <p class="muted">Elige una expresión para la pantalla de Walter.</p>
      <div id="face-options" role="group" aria-label="Expresiones del rostro"></div>
    </div>

    <div id="custom-arms" hidden>
      <button class="custom-return" type="button" data-back="arms">
        ← Volver a opciones
      </button>
      <p class="muted">
        Cambia ambos brazos y manos. Conservan el color que hayas elegido.
      </p>
      <div class="custom-menu" role="group" aria-label="Diseños de brazos y manos">
        <button class="custom-choice" type="button"
          data-arm-style="long" aria-pressed="false">
          <span>Brazos versión 1</span>
          <small>Brazos continuos con extremos redondeados, sin manos ni dedos.</small>
        </button>
        <button class="custom-choice" type="button"
          data-arm-style="claw" aria-pressed="false">
          <span>Mano tipo garra</span>
          <small>Cubiertas más anchas y una pinza con dedos curvos.</small>
        </button>
        <button class="custom-choice" type="button"
          data-arm-style="original" aria-pressed="true">
          <span>Diseño original</span>
          <small>Volver a los brazos y las manos iniciales de Walter.</small>
        </button>
      </div>
      <p id="arm-style-status" class="muted" role="status" aria-live="polite"></p>
    </div>
  `;
  anchor.appendChild(panel);

  const zones = [
    {id: 'head', title: 'Cabeza', initial: '#ecece7'},
    {id: 'body', title: 'Cuerpo', initial: '#ecece7'},
    {id: 'arms', title: 'Brazos y manos', initial: '#ecece7'},
    {id: 'base', title: 'Plataforma de la base', initial: '#9b805e'}
  ];

  const targets = Object.fromEntries(zones.map(zone => [zone.id, []]));
  const saved = [], visited = new Set();
  const options = panel.querySelector('#custom-options');

  // Incluye también los diseños ocultos para conservar el color al cambiar.
  model.interactive.forEach(mesh => {
    if (visited.has(mesh)) return;
    visited.add(mesh);

    const isArray = Array.isArray(mesh.material);
    const originals = isArray ? mesh.material : [mesh.material];
    const materials = originals.map(original => {
      if (!original || !original.color) return original;
      const color = original.color.getHex();
      const part = mesh.userData.part;
      let zone = null;

      if (color === 0xecece7 && ['head', 'body', 'arms'].includes(part)) {
        zone = part;
      }
      if (part === 'base' && color === 0x9b805e) zone = 'base';
      if (!zone) return original;

      const material = original.clone();
      targets[zone].push(material);
      saved.push({material, color: material.color.clone()});
      return material;
    });

    mesh.material = isArray ? materials : materials[0];
  });

  zones.forEach(zone => {
    const row = document.createElement('div');
    row.className = 'custom-row';
    row.dataset.zone = zone.id;
    row.innerHTML = `
      <div class="custom-row-title">
        <span>${zone.title}</span>
        <label class="custom-color-label">
          Elegir color
          <input type="color" value="${zone.initial}"
            aria-label="Color personalizado: ${zone.title}">
        </label>
      </div>
    `;
    row.querySelector('input').addEventListener('input', event => {
      targets[zone.id].forEach(material => {
        material.color.set(event.target.value);
      });
    });
    options.appendChild(row);
  });

  const armButtons = panel.querySelectorAll('[data-arm-style]');
  const armStatus = panel.querySelector('#arm-style-status');
  const supportsArmStyles = typeof model.setArmStyle === 'function';

  function updateArmButtons() {
    const style = model.getArmStyle?.() || 'original';
    armButtons.forEach(button => {
      button.setAttribute(
        'aria-pressed', String(button.dataset.armStyle === style)
      );
    });
  }

  armButtons.forEach(button => {
    button.disabled = !supportsArmStyles;
    button.addEventListener('click', () => {
      model.setArmStyle(button.dataset.armStyle);
      updateArmButtons();
      armStatus.textContent =
        `${button.querySelector('span').textContent} seleccionado.`;
    });
  });

  if (!supportsArmStyles) {
    armStatus.textContent =
      'Falta cargar js/brazos.js después de modelo.js y antes de app.js.';
  }
  updateArmButtons();

  const trigger = anchor.querySelector('#customize');
  const closeButton = panel.querySelector('#custom-close');
  const title = panel.querySelector('#custom-title');
  const screens = {
    home: panel.querySelector('#custom-home'),
    colors: panel.querySelector('#custom-colors'),
    clothes: panel.querySelector('#custom-clothes'),
    faces: panel.querySelector('#custom-faces'),
    arms: panel.querySelector('#custom-arms')
  };
  const titles = {
    home: 'Personaliza a Walter',
    colors: 'Cambiar color',
    clothes: 'Ropa y accesorios',
    faces: 'Cambiar rostro',
    arms: 'Brazos y manos'
  };
  let currentScreen = 'home';

  function showScreen(name, focus = true) {
    currentScreen = name;
    Object.entries(screens).forEach(([key, screen]) => {
      screen.hidden = key !== name;
    });
    title.textContent = titles[name];
    panel.scrollTop = 0;
    if (focus) title.focus({preventScroll: true});
  }

  function setOpen(open, returnFocus = false) {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    trigger.classList.toggle('active', open);
    trigger.textContent = open ? 'Personalizar ▴' : 'Personalizar ▾';

    if (open) {
      showScreen('home', false);
      panel.querySelector('#choose-colors').focus({preventScroll: true});
    } else if (returnFocus) {
      trigger.focus({preventScroll: true});
    }
  }

  function goBack() {
    const previous = currentScreen;
    showScreen('home', false);
    panel.querySelector('#choose-' + previous)?.focus({preventScroll: true});
  }

  trigger.onclick = () => setOpen(panel.hidden);
  closeButton.onclick = () => setOpen(false, true);

  ['colors', 'clothes', 'faces', 'arms'].forEach(name => {
    panel.querySelector('#choose-' + name).onclick = () => showScreen(name);
  });
  panel.querySelectorAll('[data-back]').forEach(button => {
    button.onclick = goBack;
  });

  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !anchor.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    if (currentScreen !== 'home') goBack();
    else setOpen(false, true);
  }, true);

  panel.querySelector('#custom-reset').onclick = () => {
    saved.forEach(({material, color}) => material.color.copy(color));
    zones.forEach(zone => {
      options.querySelector(`[data-zone="${zone.id}"] input`).value = zone.initial;
    });
  };

  let style = document.querySelector('#custom-arms-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'custom-arms-style';
    document.head.appendChild(style);
  }
  style.textContent = `
    #custom-arms .custom-menu {
      display: grid;
      gap: 12px;
    }
    #custom-arms [data-arm-style] {
      width: 100%;
      min-height: 82px;
      padding: 16px;
      text-align: left;
      cursor: pointer;
      touch-action: manipulation;
    }
    #custom-arms [data-arm-style][aria-pressed="true"] {
      border-color: #65cfff;
      background: #203e51;
      box-shadow: inset 3px 0 #65cfff;
    }
    #custom-arms [data-arm-style]:focus-visible {
      outline: 2px solid #65cfff;
      outline-offset: 3px;
    }
    #custom-arms [data-arm-style]:disabled {
      opacity: .5;
      cursor: not-allowed;
    }
    #arm-style-status {
      min-height: 22px;
      margin: 14px 0 0;
    }
  `;
};