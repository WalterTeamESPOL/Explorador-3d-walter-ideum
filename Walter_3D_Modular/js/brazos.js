// Diseños de brazos y manos.
// Cargar después de modelo.js y antes de app.js.
(() => {
  const crearModeloOriginal = Walter.crearModelo;

  Walter.crearModelo = function(scene) {
    const model = crearModeloOriginal(scene);
    const variants = [];
    let current = 'original';

    const white = new THREE.MeshStandardMaterial({
      color: 0xecece7, roughness: .48, metalness: .15
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x20282d, roughness: .55, metalness: .15
    });
    const metal = new THREE.MeshStandardMaterial({
      color: 0x9da6aa, roughness: .4, metalness: .75
    });

    function group(parent) {
      const result = new THREE.Group();
      result.visible = false;
      parent.add(result);
      return result;
    }

    function mesh(parent, geometry, material, x, y, z, label) {
      const object = new THREE.Mesh(geometry, material);
      object.position.set(x, y, z);
      object.castShadow = true;
      object.receiveShadow = true;
      object.userData = {part: 'arms', label, armVariant: true};
      parent.add(object);
      model.interactive.push(object);
      return object;
    }

    function rounded(parent, w, h, depth, radius, material, x, y, z, label) {
      const shape = new THREE.Shape();
      const a = w / 2, b = h / 2;
      const r = Math.min(radius, a, b);

      shape.moveTo(-a + r, -b);
      shape.lineTo(a - r, -b);
      shape.quadraticCurveTo(a, -b, a, -b + r);
      shape.lineTo(a, b - r);
      shape.quadraticCurveTo(a, b, a - r, b);
      shape.lineTo(-a + r, b);
      shape.quadraticCurveTo(-a, b, -a, b - r);
      shape.lineTo(-a, -b + r);
      shape.quadraticCurveTo(-a, -b, -a + r, -b);

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: false, curveSegments: 16
      });
      geometry.translate(0, 0, -depth / 2);
      return mesh(parent, geometry, material, x, y, z, label);
    }

    function sphere(parent, x, y, z, sx, sy, sz, material, label) {
      const object = mesh(
        parent, new THREE.SphereGeometry(1, 28, 20),
        material, x, y, z, label
      );
      object.scale.set(sx, sy, sz);
      return object;
    }

    function bolt(parent, x, y, z) {
      const object = mesh(
        parent, new THREE.CylinderGeometry(.018, .018, .012, 12),
        metal, x, y, z, 'Tornillo de la cubierta'
      );
      object.rotation.x = Math.PI / 2;
    }

    function findChild(root, label) {
      let result = null;
      root.traverse(object => {
        if (!result && object.userData.label === label) result = object;
      });
      return result;
    }

    function curvedFinger(parent, side) {
      const shape = new THREE.Shape();
      shape.moveTo(.035, -.15);
      shape.quadraticCurveTo(.18, -.17, .19, -.29);
      shape.quadraticCurveTo(.19, -.40, .10, -.45);
      shape.quadraticCurveTo(.065, -.46, .055, -.425);
      shape.quadraticCurveTo(.14, -.35, .115, -.27);
      shape.quadraticCurveTo(.105, -.23, .035, -.23);
      shape.closePath();

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: .095, bevelEnabled: true,
        bevelThickness: .008, bevelSize: .008,
        bevelSegments: 2, curveSegments: 16
      });
      geometry.translate(0, 0, -.0475);

      const finger = mesh(
        parent, geometry, white, 0, 0, .025,
        'Dedo curvo de la mano'
      );
      if (side < 0) finger.rotation.y = Math.PI;
    }

    model.arms.forEach(arm => {
      const upper = findChild(arm.shoulder, 'Cubierta del brazo');
      const lower = findChild(arm.elbow, 'Cubierta del antebrazo');
      if (!upper || !lower) return;

      const upperParent = upper.parent;
      const originalShoulderPosition = arm.shoulder.position.clone();
      const originalHands = [...arm.wrist.children];

      // Estructura, motor del codo y cables del diseño articulado.
      const mechanics = arm.shoulder.children.filter(object =>
        object !== upperParent && object !== arm.elbow
      );

      // Soporte y motor originales del hombro.
      const shoulderHardware = arm.group.children.filter(object =>
        object !== arm.shoulder
      );

      // VERSIÓN 1: brazo corto, continuo y sin dedos.
      const versionOne = group(upperParent);
      rounded(
        versionOne, .23, 1.02, .18, .11, white,
        0, -.49, .035, 'Brazo continuo de la versión 1'
      );
      sphere(
        versionOne, 0, -.07, .025,
        .135, .16, .115, white,
        'Cubierta superior de la versión 1'
      );

      // Unión fija entre el torso y el pivote del brazo.
      const shoulderCap = group(arm.group);
      rounded(
        shoulderCap, .30, .15, .20, .065, white,
        arm.side * .69, .64, .025,
        'Unión del hombro de la versión 1'
      );
      sphere(
        shoulderCap, arm.side * .80, .64, .025,
        .13, .15, .13, white,
        'Articulación cubierta de la versión 1'
      );

      // DISEÑO ARTICULADO CON MANO CURVA.
      const clawUpper = group(upperParent);
      rounded(
        clawUpper, .32, .54, .27, .12, white,
        0, -.42, .03, 'Cubierta ancha del brazo'
      );
      [-.085, .085].forEach(x => {
        bolt(clawUpper, x, -.24, .173);
        bolt(clawUpper, x, -.60, .173);
      });

      const clawLower = group(lower.parent);
      rounded(
        clawLower, .28, .58, .25, .11, white,
        0, -.43, .03, 'Cubierta ancha del antebrazo'
      );
      rounded(
        clawLower, .13, .18, .012, .025, dark,
        0, -.24, .162, 'Panel del antebrazo'
      );
      [-.075, .075].forEach(x => {
        bolt(clawLower, x, -.43, .163);
        bolt(clawLower, x, -.63, .163);
      });

      const clawHand = group(arm.wrist);
      rounded(
        clawHand, .20, .09, .14, .025, dark,
        0, -.035, .025, 'Unión de muñeca'
      );
      sphere(
        clawHand, 0, -.13, .025,
        .135, .12, .095, white, 'Palma de mano curva'
      );
      curvedFinger(clawHand, -1);
      curvedFinger(clawHand, 1);

      variants.push({
        arm, upper, lower, originalHands,
        originalShoulderPosition,
        mechanics, shoulderHardware,
        versionOne, shoulderCap,
        clawUpper, clawLower, clawHand
      });
    });

    model.setArmStyle = function(style) {
      if (!['original', 'long', 'claw'].includes(style)) return;
      current = style;

      variants.forEach(v => {
        const original = style === 'original';
        const versionOne = style === 'long';
        const claw = style === 'claw';

        // La versión 1 tiene el pivote más cerca del torso.
        v.arm.shoulder.position.copy(v.originalShoulderPosition);
        if (versionOne) v.arm.shoulder.position.x = v.arm.side * .80;

        v.upper.visible = original;
        v.lower.visible = original;
        v.originalHands.forEach(object => {
          object.visible = original;
        });

        v.versionOne.visible = versionOne;
        v.shoulderCap.visible = versionOne;

        v.clawUpper.visible = claw;
        v.clawLower.visible = claw;
        v.clawHand.visible = claw;

        // Oculta las articulaciones que no usa el brazo rígido.
        v.arm.elbow.visible = !versionOne;
        v.mechanics.forEach(object => {
          object.visible = !versionOne;
        });
        v.shoulderHardware.forEach(object => {
          object.visible = !versionOne;
        });

        if (!versionOne) v.arm.shoulder.rotation.x = 0;
      });

      model.robot.updateMatrixWorld(true);
    };

    // Adapta el saludo existente sin crear otro temporizador.
    const poseOriginal = model.pose;

    model.pose = function(amount, interior) {
      poseOriginal(amount, interior);

      variants.forEach(v => {
        const shoulder = v.arm.shoulder;

        if (current === 'long') {
          // Toma el avance del saludo original.
          const levantar = shoulder.rotation.z;
          const balanceo = v.arm.wrist.rotation.z;

          // Solo gira hacia adelante y atrás desde el hombro.
          shoulder.rotation.x = levantar * 1.15 + balanceo * .35;
          shoulder.rotation.z = 0;
        } else {
          // Los diseños articulados mantienen su saludo original.
          shoulder.rotation.x = 0;
        }
      });
    };

    model.getArmStyle = () => current;
    model.setArmStyle('original');
    return model;
  };
})();