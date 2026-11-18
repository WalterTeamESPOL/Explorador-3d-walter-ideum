// Controles originales y recorrido con pausa al inspeccionar.
Walter.conectarControles = function(canvas, camera, model, actions) {
  const {state, select, zoom, setAuto, setExplosion, inspect} = actions;
  const pointers = new Map();
  const ray = new THREE.Raycaster();
  const homePosition = model.robot.position.clone();
  const TAU = Math.PI * 2;

  let start = null, moved = false, multi = false, previousGap = 0;
  let faceOn = true, driveOn = false;
  let previousView = state.view;
  let drive = null;
  let pauseUntil = 0;

  const faceParts = model.interactive.filter(mesh =>
    mesh.userData.part === 'head' &&
    ['Ojo de la pantalla', 'Expresión de la pantalla'].includes(mesh.userData.label)
  );

  const powerButton = model.interactive.find(mesh => mesh.userData.powerButton);
  const powerColor = powerButton ? powerButton.material.color.clone() : null;

  const driveButton = model.interactive.find(mesh =>
    mesh.userData.part === 'base' &&
    (mesh.userData.label === 'Interruptor' ||
      mesh.userData.action === 'toggle-drive')
  );
  const driveColor = driveButton ? driveButton.material.color.clone() : null;

  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
  canvas.parentElement.appendChild(status);

  if (driveButton) {
    driveButton.userData.action = 'toggle-drive';

    const frame = model.interactive.find(mesh =>
      mesh.userData.label === 'Marco del interruptor' &&
      mesh.userData.action !== 'toggle-face' &&
      Math.abs(mesh.position.x - driveButton.position.x) < .001
    );
    if (frame) frame.userData.action = 'toggle-drive';
  }

  const DRIVE = {
    laps: 3,
    rightDistance: 1.65,
    radius: .72,
    turnTime: .65,
    moveTime: 1.8,
    lapTime: 3.5,
    returnTime: 1.8,
    restoreTime: .65,
    planeTilt: THREE.MathUtils.degToRad(25)
  };

  const wheels = model.interactive.filter(mesh =>
    ['Rueda lateral', 'Centro de rueda'].includes(mesh.userData.label)
  );

  function smooth(value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function shortestAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  function paintDriveButton() {
    if (!driveButton) return;
    driveButton.rotation.x = driveOn ? -.15 : .15;

    if (driveOn) driveButton.material.color.copy(driveColor);
    else driveButton.material.color.set(0x542725);

    driveButton.userData.label = driveOn
      ? 'Apagar movimiento'
      : 'Encender movimiento';
  }

  function paintPowerButton() {
    if (!powerButton) return;
    powerButton.rotation.x = faceOn ? -.15 : .15;

    if (faceOn) powerButton.material.color.copy(powerColor);
    else powerButton.material.color.set(0x542725);

    powerButton.userData.label = faceOn ? 'Apagar rostro' : 'Encender rostro';
  }

  function cancelDrive() {
    // Cancela sin cambiar la posición actual.
    drive = null;
  }

  function prepareFrame() {
    cancelDrive();
    model.robot.position.copy(homePosition);
  }

  // Solo un cambio de encuadre devuelve el modelo al centro.
  const frameOriginal = model.frame;
  model.frame = function(...args) {
    prepareFrame();
    return frameOriginal.apply(model, args);
  };

  function applyDriveRotation() {
    if (!drive) return;

    // Conserva el orden de giro original.
    // No convierte ni combina cuaterniones durante el arrastre.
    model.robot.rotation.set(
      drive.pitch,
      drive.routeYaw + drive.manualYaw,
      0,
      'XYZ'
    );
  }

  function rotateManually(deltaYaw, deltaPitch) {
    if (drive) {
      // Solo durante el recorrido se usan estos valores independientes.
      drive.manualYaw += deltaYaw;
      drive.pitch = THREE.MathUtils.clamp(
        drive.pitch + deltaPitch, -1.2, 1.2
      );
      applyDriveRotation();
      return;
    }

    // Giro original fuera del recorrido.
    model.robot.rotation.y += deltaYaw;
    model.robot.rotation.x = THREE.MathUtils.clamp(
      model.robot.rotation.x + deltaPitch, -1.2, 1.2
    );
  }

  function finishDrive() {
    if (!drive) return;
    model.robot.position.copy(drive.origin);
    drive.routeYaw = drive.finalYaw;
    applyDriveRotation();
    drive = null;
  }

  function startDrive() {
    if (!driveOn || state.view !== 'all' || drive) return;

    model.robot.updateMatrixWorld(true);
    const box = new THREE.Box3();

    model.robot.traverseVisible(object => {
      if (!object.isMesh) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      box.union(
        object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld)
      );
    });

    const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const cameraDistance = state.radius /
      Math.sin(Math.min(vertical, horizontal)) * 1.12 *
      state.distance / 10.8;

    const halfWidth = Math.tan(vertical) * cameraDistance * camera.aspect;
    const available = Math.max(0, halfWidth * .92 - box.max.x);
    const routeScale = Math.min(
      1, available / (DRIVE.rightDistance + DRIVE.radius)
    );

    if (routeScale < .15) {
      status.textContent =
        'Aleja la vista o restablécela y vuelve a activar el movimiento.';
      return;
    }

    const startYaw = model.robot.rotation.y;
    const headingYaw = startYaw + shortestAngle(Math.PI / 2 - startYaw);
    const circleEndYaw = headingYaw + TAU * DRIVE.laps;
    const finalYaw = circleEndYaw + shortestAngle(startYaw - circleEndYaw);

    drive = {
      time: 0,
      origin: model.robot.position.clone(),
      pitch: THREE.MathUtils.clamp(model.robot.rotation.x, -1.2, 1.2),
      startYaw,
      headingYaw,
      circleEndYaw,
      finalYaw,
      routeYaw: startYaw,
      manualYaw: 0,
      rightDistance: DRIVE.rightDistance * routeScale,
      radius: DRIVE.radius * routeScale
    };

    status.textContent = 'Walter inicia las tres vueltas.';
  }

  function toggleDrive() {
    driveOn = !driveOn;
    paintDriveButton();

    if (!driveOn) {
      cancelDrive();
      status.textContent = 'Movimiento apagado.';
      return;
    }

    if (state.view === 'all') startDrive();
    else {
      status.textContent =
        'Movimiento encendido. Se iniciará al volver a Walter.';
    }
  }

  function toggleFace() {
    faceOn = !faceOn;

    if (typeof model.setFacePower === 'function') {
      model.setFacePower(faceOn);
    } else {
      faceParts.forEach(mesh => {
        mesh.visible = faceOn;
      });
    }

    paintPowerButton();

    if (faceOn && state.view === 'all') model.greet();
    else model.stopGreeting();

    status.textContent = faceOn
      ? (state.view === 'all'
        ? 'Walter encendido. Saludo iniciado.'
        : 'Rostro encendido. Saludará al volver a Walter.')
      : 'Rostro apagado.';
  }

  function syncView() {
    if (state.view === previousView) return;
    previousView = state.view;

    if (state.view !== 'all') {
      cancelDrive();
      model.stopGreeting();
      return;
    }

    if (faceOn) model.greet();
    if (driveOn) startDrive();
  }

  // El recorrido sigue activo aunque esté temporalmente pausado.
  model.isDriving = () => drive !== null;

  model.updateDrive = function(dt, paused = false) {
    syncView();
    if (!drive) return;

    if (state.view !== 'all') {
      cancelDrive();
      return;
    }

    if (
      paused ||
      document.hidden ||
      pointers.size > 0 ||
      performance.now() < pauseUntil
    ) return;

    drive.time += dt;

    const elapsed = drive.time;
    const turnEnd = DRIVE.turnTime;
    const moveEnd = turnEnd + DRIVE.moveTime;
    const circleDuration = DRIVE.laps * DRIVE.lapTime;
    const circlesEnd = moveEnd + circleDuration;
    const returnEnd = circlesEnd + DRIVE.returnTime;
    const finishEnd = returnEnd + DRIVE.restoreTime;

    const previousPosition = model.robot.position.clone();
    let x = 0, y = 0, z = 0;

    if (elapsed < turnEnd) {
      drive.routeYaw = THREE.MathUtils.lerp(
        drive.startYaw,
        drive.headingYaw,
        smooth(elapsed / DRIVE.turnTime)
      );
    } else if (elapsed < moveEnd) {
      x = drive.rightDistance * smooth(
        (elapsed - turnEnd) / DRIVE.moveTime
      );
      drive.routeYaw = drive.headingYaw;
    } else if (elapsed < circlesEnd) {
      const progress = smooth((elapsed - moveEnd) / circleDuration);
      const angle = progress * TAU * DRIVE.laps;
      const depth = drive.radius * (1 - Math.cos(angle));

      x = drive.rightDistance + drive.radius * Math.sin(angle);
      y = depth * Math.sin(DRIVE.planeTilt);
      z = -depth * Math.cos(DRIVE.planeTilt);
      drive.routeYaw = drive.headingYaw + angle;
    } else if (elapsed < returnEnd) {
      x = drive.rightDistance * (
        1 - smooth((elapsed - circlesEnd) / DRIVE.returnTime)
      );
      drive.routeYaw = drive.circleEndYaw;
    } else if (elapsed < finishEnd) {
      drive.routeYaw = THREE.MathUtils.lerp(
        drive.circleEndYaw,
        drive.finalYaw,
        smooth((elapsed - returnEnd) / DRIVE.restoreTime)
      );
    } else {
      finishDrive();
      status.textContent =
        'Recorrido terminado. El interruptor de movimiento sigue encendido.';
      return;
    }

    model.robot.position.copy(drive.origin);
    model.robot.position.x += x;
    model.robot.position.y += y;
    model.robot.position.z += z;
    applyDriveRotation();

    const distance = model.robot.position.distanceTo(previousPosition);
    const direction = elapsed >= circlesEnd ? -1 : 1;
    wheels.forEach(wheel => {
      wheel.rotateY(direction * distance / .245);
    });
  };

  const greetingTimer = setInterval(() => {
    if (!faceOn || document.hidden || pointers.size > 0) return;
    if (state.view !== 'all') return;
    model.greet();
  }, 10000);

  window.addEventListener('pagehide', event => {
    if (!event.persisted) clearInterval(greetingTimer);
  });

  document.querySelector('#reset')?.addEventListener(
    'click', prepareFrame, true
  );

  function gap() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  canvas.onpointerdown = event => {
    if (
      (event.pointerType === 'mouse' && event.button !== 0) ||
      pointers.size >= 2
    ) return;

    canvas.setPointerCapture(event.pointerId);
    canvas.focus({preventScroll: true});
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    setAuto(false);

    if (pointers.size === 1) {
      start = {x: event.clientX, y: event.clientY};
      moved = false;
      multi = false;
    } else {
      multi = true;
      moved = true;
      previousGap = gap();
    }
  };

  canvas.onpointermove = event => {
    if (!pointers.has(event.pointerId)) return;

    const old = pointers.get(event.pointerId);
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});

    if (pointers.size === 2) {
      const next = gap();
      setExplosion(
        state.target +
        (next - previousGap) / Math.max(160, canvas.clientWidth * .35)
      );
      previousGap = next;
      return;
    }

    if (multi) return;
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7
    ) moved = true;
    if (!moved) return;

    rotateManually(
      (event.clientX - old.x) * .008,
      (event.clientY - old.y) * .006
    );
  };

  function visible(object) {
    for (let parent = object; parent; parent = parent.parent) {
      if (!parent.visible) return false;
    }
    return true;
  }

  function release(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;

    if (!cancelled && !moved && !multi && pointers.size === 1) {
      const rect = canvas.getBoundingClientRect();
      model.robot.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);

      ray.setFromCamera(new THREE.Vector2(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -(event.clientY - rect.top) / rect.height * 2 + 1
      ), camera);

      const hit = ray.intersectObjects(
        model.interactive.filter(visible), false
      )[0];
      const data = hit?.object.userData;

      if (data?.action === 'toggle-face') {
        toggleFace();
      } else if (data?.action === 'toggle-drive') {
        toggleDrive();
      } else if (!drive && data) {
        if (state.view === 'all') select(data.part);
        else inspect(data.label);
      }
    }

    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (!pointers.size) {
      start = null;
      moved = false;
      multi = false;
    }
  }

  canvas.onpointerup = event => release(event);
  canvas.onpointercancel = event => release(event, true);
  canvas.onlostpointercapture = event => release(event, true);

  function clearPointers() {
    const ids = [...pointers.keys()];
    pointers.clear();
    start = null;
    moved = false;
    multi = false;
    previousGap = 0;

    ids.forEach(id => {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    });
  }

  window.addEventListener('blur', clearPointers);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearPointers();
  });

  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    pauseUntil = performance.now() + 180;
    zoom(event.deltaY * .005);
  }, {passive: false});

  canvas.onkeydown = event => {
    const keys = [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', 'Escape'
    ];
    if (!keys.includes(event.key)) return;

    event.preventDefault();
    setAuto(false);

    if (event.key === 'Escape') {
      prepareFrame();
      select('all');
      return;
    }

    pauseUntil = performance.now() + 150;
    if (event.key === '+') zoom(-.7);
    if (event.key === '-') zoom(.7);
    if (event.key === 'ArrowLeft') rotateManually(-.12, 0);
    if (event.key === 'ArrowRight') rotateManually(.12, 0);
    if (event.key === 'ArrowUp') rotateManually(0, -.1);
    if (event.key === 'ArrowDown') rotateManually(0, .1);
  };

  paintDriveButton();
  paintPowerButton();
};