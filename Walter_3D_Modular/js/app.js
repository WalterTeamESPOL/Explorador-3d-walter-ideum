// Conecta la escena, el modelo, la personalización y los controles.
(() => {
  const canvas = document.querySelector('#view');
  const stage = document.querySelector('#stage');
  const state = {distance:10.8, auto:false, selected:'head'};

  try {
    const world = Walter.crearEscena(canvas);
    const model = Walter.crearModelo(world.scene);
    const actions = Walter.conectarInterfaz(model, state);

    Walter.conectarPersonalizacion(model);
    Walter.conectarRopa(model, state);
    Walter.conectarRostros(model);
    Walter.conectarControles(canvas, world.camera, model, actions);
    Walter.iniciarAnimacion(stage, world, model, state);
  } catch (error) {
    const message = document.querySelector('#error');
    message.style.display = 'block';
    message.textContent = 'No se pudo iniciar la vista 3D. Revisa los archivos del proyecto y la consola del navegador.';
    console.error(error);
  }
})();