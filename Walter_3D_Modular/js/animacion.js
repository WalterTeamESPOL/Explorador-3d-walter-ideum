// Giro automático, separación, saludo y recorrido de la base.
Walter.iniciarAnimacion = function(stage, world, model, state) {
  const {renderer, camera, scene} = world;
  const canvas = stage.querySelector('#view');
  const rotationSpeed = .25;
  const resumeDelay = 150;
  const pointers = new Set(), keys = new Set();
  const controlKeys = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', 'Escape'
  ]);
  let resumeAt = 0, last = null;

  const rotateButton = document.querySelector('#rotate');
  if (rotateButton) rotateButton.hidden = true;

  function pause() {
    resumeAt = performance.now() + resumeDelay;
    state.auto = false;
  }

  function isRobotInteraction(target) {
    return target === canvas || (
      target instanceof Element &&
      Boolean(target.closest('#stage > .toolbar, #stage > .section-tools'))
    );
  }

  stage.addEventListener('pointerdown', event => {
    if (!isRobotInteraction(event.target)) return;
    pointers.add(event.pointerId);
    pause();
  }, true);

  window.addEventListener('pointermove', event => {
    if (pointers.has(event.pointerId)) pause();
  }, true);

  function release(event) {
    if (pointers.delete(event.pointerId)) pause();
  }

  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  stage.addEventListener('lostpointercapture', release, true);

  canvas.addEventListener('wheel', pause, {
    passive: true, capture: true
  });

  stage.addEventListener('click', event => {
    if (isRobotInteraction(event.target)) pause();
  }, true);

  canvas.addEventListener('keydown', event => {
    if (!controlKeys.has(event.key)) return;
    keys.add(event.code || event.key);
    pause();
  }, true);

  window.addEventListener('keyup', event => {
    if (keys.delete(event.code || event.key)) pause();
  }, true);

  function clearInteraction() {
    pointers.clear();
    keys.clear();
    resumeAt = 0;
    last = null;
  }

  window.addEventListener('blur', clearInteraction);
  canvas.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', clearInteraction);

  function resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  function render(time) {
    requestAnimationFrame(render);
    const dt = last === null ? 0 : Math.min((time - last) / 1000, .05);
    last = time;

    const interacting = pointers.size > 0 || keys.size > 0;
    const driving = Boolean(model.isDriving?.());

    state.auto = !document.hidden &&
      !interacting &&
      !driving &&
      time >= resumeAt;

    // El giro de exposición se pausa durante el recorrido.
    if (state.auto) model.robot.rotation.y += dt * rotationSpeed;

    // Conserva la separación y la animación de saludo.
    state.current += (state.target - state.current) * (1 - Math.exp(-10 * dt));
    if (Math.abs(state.current - state.target) < .001) {
      state.current = state.target;
    }
    model.pose(state.current, state.view !== 'all');

    // Tocar el robot pausa el recorrido mientras se mantiene el contacto.
    // Leer o desplazar el panel derecho no lo pausa.
    if (typeof model.updateDrive === 'function') {
      model.updateDrive(dt, document.hidden || interacting);
    }

    const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const distance = state.radius /
      Math.sin(Math.min(vertical, horizontal)) * 1.12;

    camera.position.set(0, 0, distance * state.distance / 10.8);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  requestAnimationFrame(render);
};