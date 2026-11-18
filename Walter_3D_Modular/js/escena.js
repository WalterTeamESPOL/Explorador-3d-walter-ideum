// Escena, cámara y luces. Devuelve los objetos que comparten los otros módulos.
window.Walter = {};

Walter.crearEscena = function(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // 3. ESCENA Y CÁMARA: la cámara determina desde dónde vemos el robot.
    const scene = new THREE.Scene, camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(14743295, 2504256, 2.5));
  const key = new THREE.DirectionalLight(16771792, 4);
  key.position.set(-4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new THREE.DirectionalLight(8840429, 3);
  rim.position.set(4, 3, -3);
  scene.add(rim);
  return {
    renderer: renderer,
    scene: scene,
    camera: camera
  };
};
