// Interfaz del explorador: vista general, secciones e interiores.
Walter.conectarInterfaz = function(model, state) {
  const $ = s => document.querySelector(s);
  const data = {
    head: {
      number: '01', title: 'Cabeza', subtitle: 'Pantalla y cámara',
      description: 'Explora la carcasa, la pantalla, la cámara frontal y el soporte del cuello. Pulsa Ver interior para abrir las cubiertas.'
    },
    body: {
      number: '02', title: 'Cuerpo', subtitle: 'Mini PC y electrónica',
      description: 'Descubre la estructura central, las cubiertas del torso y la representación de sus componentes electrónicos.'
    },
    arms: {
      number: '03', title: 'Brazos', subtitle: 'Articulaciones y manos',
      description: 'Explora ambos brazos, sus articulaciones, soportes y manos. Abre las cubiertas para observar su estructura.'
    },
    base: {
      number: '04', title: 'Base', subtitle: 'Ruedas y plataformas',
      description: 'Conoce las plataformas, las ruedas, los soportes y la electrónica de la base. Abre el interior para levantar la tapa superior.'
    }
  };

  // Actualiza la cabecera conservando el HTML existente.
  $('header strong').textContent = 'Walter, el robot humanoide';
  const headerLabel = $('header > div > span');
  if (headerLabel) headerLabel.textContent = 'Laboratorio interactivo';
  $('.counter').textContent = 'Walter versión 2.0';
  $('aside h2').innerHTML = 'Pequeñas partes.<br>Grandes posibilidades.';
  $('aside > .muted').textContent = 'Elige una sección para verla sola y explorar su interior.';
  $('.hint').textContent = '';

  const nav = $('aside nav');
  nav.setAttribute('aria-label', 'Secciones de Walter');
  nav.innerHTML = Object.entries(data).map(([key, d]) =>
    `<button type="button" class="part" data-part="${key}" aria-pressed="false">
      <span>${d.title}<small>${d.subtitle}</small></span>
    </button>`
  ).join('');

  const tools = document.createElement('div');
  tools.className = 'section-tools';
  tools.innerHTML = '<button id="back" type="button" hidden>Volver a Walter</button><button id="open" type="button" aria-expanded="false">Separar piezas</button>';
  $('#stage').appendChild(tools);

  const list = document.createElement('div');
  list.id = 'components';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', 'Componentes de la sección');
  $('.detail').appendChild(list);

  const rotateButton = $('#rotate');
  if (rotateButton) rotateButton.hidden = true;

  function setAuto(value) {
    state.auto = value;
    if (!rotateButton) return;
    rotateButton.setAttribute('aria-pressed', String(value));
    rotateButton.setAttribute('aria-label', value ? 'Pausar giro automático' : 'Activar giro automático');
  }

  function setExplosion(value) {
    state.target = THREE.MathUtils.clamp(value, 0, 1);
    const open = state.target > .01;
    $('#open').textContent = state.view === 'all'
      ? (open ? 'Unir piezas' : 'Separar piezas')
      : (open ? 'Cerrar interior' : 'Ver interior');
    $('#open').setAttribute('aria-expanded', String(open));
  }

  function inspect(label) {
    $('#part-description').textContent = label + '. Representación visual aproximada; no especifica el modelo exacto ni las conexiones reales.';
    list.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.textContent === label));
    });
  }

  function select(part) {
    if (part !== 'all' && !data[part]) return;
    const focusWillBeHidden = part === 'all' && document.activeElement === $('#back');
    const d = data[part];
    state.view = part;
    state.selected = part;
    state.current = 0;
    state.distance = 10.8;
    state.radius = model.frame(part);
    setAuto(false);
    setExplosion(0);

    nav.querySelectorAll('[data-part]').forEach(button => {
      const active = button.dataset.part === part;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    $('#back').hidden = part === 'all';
    $('#part-number').textContent = d ? 'Componente ' + d.number : 'Vista general';
    $('#part-title').textContent = d ? d.title : 'Conoce a Walter';
    $('#part-description').innerHTML = d
      ? String(d.description ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
: `<span class="walter-bio">
      <span class="walter-paragraph">Walter es un robot social de 1,30 metros creado en la Escuela Superior Politécnica del Litoral (ESPOL) por el Dr. Dennys Paillacho, junto con estudiantes y profesionales de CIDIS y FIEC.</span>
      <span class="walter-section">
      <span class="walter-subtitle">Robótica para las personas</span>
      <span class="walter-paragraph">Combina robótica e inteligencia artificial para crear interacciones cercanas, educativas y entretenidas. Amable y curioso, está pensado para acompañar a personas de distintas edades.</span>
    </span>
    <span class="walter-section">
      <span class="walter-subtitle">Aprender y acompañar</span>
      <span class="walter-paragraph">Busca apoyar el aprendizaje de los niños, brindar compañía a los adultos mayores y despertar el interés por la ciencia. También participa como anfitrión y guía en espacios de divulgación e innovación.</span>
    </span>
    <span class="walter-section">
      <span class="walter-subtitle">Mi recorrido</span>
      <span class="walter-events">
        <span>Lab Connect · FIEC–ESPOL</span>
        <span>Ferias universitarias de ESPOL</span>
        <span>STS Forum Latam</span>
        <span>InnovaFest Latam</span>
        <span>Casa Abierta de Innovación y Sostenibilidad</span>
        <span>La Ruta de la Innovación</span>
      </span>
    </span>
    <span class="walter-callout"><strong>¡Descubre cómo estoy construido!</strong><span>Explora mi cabeza, cuerpo, brazos y base.</span></span>
  </span>`;
    $('.intro h1').textContent = d ? d.title + ' de Walter.' : 'Visualiza a Walter.';
    $('.intro p').textContent = d ? 'Gira la pieza y pulsa Ver interior.' : 'Toca una sección para entrar.';

    list.replaceChildren();
    if (d) {
      const labels = [...new Set(model.interactive
        .filter(mesh => mesh.userData.part === part)
        .map(mesh => mesh.userData.label))];
      labels.forEach(label => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-pressed', 'false');
        button.onclick = () => inspect(label);
        list.appendChild(button);
      });
    }
    if (focusWillBeHidden) $('#open').focus({preventScroll: true});
  }

  function zoom(delta) {
    state.distance = THREE.MathUtils.clamp(state.distance + delta, 5, 19);
  }

  nav.querySelectorAll('[data-part]').forEach(button => {
    button.onclick = () => select(button.dataset.part);
  });
  $('#back').onclick = () => select('all');
  $('#open').onclick = () => {
    setAuto(false);
    setExplosion(state.target > .01 ? 0 : 1);
  };
  $('#reset').onclick = () => select(state.view);
  $('#in').onclick = () => zoom(-.7);
  $('#out').onclick = () => zoom(.7);
  if (rotateButton) rotateButton.onclick = () => setAuto(!state.auto);

  function updateFullscreen() {
    const full = Boolean(document.fullscreenElement);
    $('#full').textContent = full ? 'Salir de pantalla completa' : 'Pantalla completa';
    $('#full').setAttribute('aria-pressed', String(full));
  }
  $('#full').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      $('#full').textContent = 'Usa F11 para ampliar';
    }
  };
  document.addEventListener('fullscreenchange', updateFullscreen);
  updateFullscreen();
  select('all');
  return {select, zoom, setAuto, setExplosion, inspect, state};
};