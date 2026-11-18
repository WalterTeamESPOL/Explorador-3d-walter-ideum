// Rostros basados en el SVG original de Walter.
Walter.conectarRostros = function(model) {
  const options = document.querySelector('#face-options');
  if (!options) return;
  options.replaceChildren();

  const screen = model.interactive.find(mesh =>
    mesh.userData.label === 'Pantalla facial'
  );
  if (!screen) throw new Error('No se encontró la pantalla facial de Walter.');

  const originalFace = model.interactive.filter(mesh =>
    mesh.userData.part === 'head' &&
    ['Ojo de la pantalla', 'Expresión de la pantalla'].includes(mesh.userData.label)
  );
  originalFace.forEach(mesh => mesh.visible = false);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear la pantalla de expresiones.');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map:texture, transparent:true, toneMapped:false
  });
  const display = new THREE.Mesh(new THREE.PlaneGeometry(.99, .58), material);
  display.position.set(0, 1.67, .48);
  display.userData = {part:'head', label:'Pantalla de expresiones'};
  screen.parent.add(display);
  model.interactive.push(display);

  const cyan = '#1de4ff', red = '#ff1a1a';
  let expression = 'normal';
  let powered = true;
  let mouthOpen = false;

  const faces = [
    {id:'normal', name:'Normal'},
    {id:'happy', name:'Feliz'},
    {id:'angry', name:'Enojado'},
    {id:'sad', name:'Triste'},
    {id:'monkey', name:'Mono'}
  ];

  // Geometría del SVG original.
  const paths = {
    angryL:new Path2D('M-135 -165 Q-40 -75 125 -45 Q115 55 40 95 Q-55 120 -110 35 Q-135 -10 -135 -165 Z'),
    angryR:new Path2D('M135 -165 Q40 -75 -125 -45 Q-115 55 -40 95 Q55 120 110 35 Q135 -10 135 -165 Z'),
    happyLid:new Path2D('M-130 25 Q0 105 130 25 L130 140 L-130 140 Z'),
    sadLidL:new Path2D('M-140 -150 L140 -150 L140 -85 Q0 -55 -140 -20 Z'),
    sadLidR:new Path2D('M-140 -150 L140 -150 L140 -20 Q0 -55 -140 -85 Z'),
    mouthClosed:new Path2D('M380 615 Q500 665 620 615'),
    mouthOpen:new Path2D('M390 630 C440 655 560 655 610 630 C625 622 635 638 625 650 C570 710 430 710 375 650 C365 638 375 622 390 630 Z'),
    mouthSad:new Path2D('M380 655 Q500 550 620 655'),
    mouthSadOpen:new Path2D('M380 635 Q500 545 620 635 Q585 710 500 712 Q415 710 380 635 Z'),
    mouthAngry:new Path2D('M380 635 Q500 545 620 635'),
    mouthAngryOpen:new Path2D('M380 635 Q500 545 620 635 Q585 710 500 712 Q415 710 380 635 Z')
  };
  const normalEye = new Path2D();
  normalEye.ellipse(0, 0, 115, 125, 0, 0, Math.PI * 2);

  function oval(x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function fill(path, color) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }

  function line(path, color, width = 30) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  }

  function drawEye(side) {
    ctx.save();
    ctx.translate(side === 'L' ? 300 : 700, 450);

    const angry = expression === 'angry';
    const eye = angry ? paths['angry' + side] : normalEye;
    fill(eye, angry ? red : cyan);

    // El reflejo queda recortado por la forma visible del ojo.
    ctx.save();
    ctx.clip(eye);
    oval(55, -45, 40, 35, '#ffffff');
    ctx.restore();

    if (expression === 'happy') fill(paths.happyLid, '#000000');
    if (expression === 'sad') fill(paths['sadLid' + side], '#000000');
    ctx.restore();
  }

  function drawMouth() {
    let path = mouthOpen ? paths.mouthOpen : paths.mouthClosed;
    let color = cyan;
    let width = 30;

    if (expression === 'sad') {
      path = mouthOpen ? paths.mouthSadOpen : paths.mouthSad;
    }
    if (expression === 'angry') {
      path = mouthOpen ? paths.mouthAngryOpen : paths.mouthAngry;
      color = red;
    }
    if (mouthOpen && ['sad','angry'].includes(expression)) {
      fill(path, '#080808');
      width = 18;
    }
    line(path, color, width);
  }

  function drawMonkey() {
    // Variante independiente para acompañar el disfraz.
    oval(500, 455, 310, 275, '#875335');
    oval(375, 410, 150, 170, '#dfb98c');
    oval(625, 410, 150, 170, '#dfb98c');
    oval(500, 560, 220, 145, '#dfb98c');
    oval(365, 415, 48, 65, '#17212c');
    oval(635, 415, 48, 65, '#17212c');
    oval(350, 392, 14, 18, '#ffffff');
    oval(620, 392, 14, 18, '#ffffff');
    oval(478, 515, 13, 9, '#875335');
    oval(522, 515, 13, 9, '#875335');

    if (mouthOpen) {
      oval(500, 605, 55, 45, '#593923');
    } else {
      line(new Path2D('M410 575 Q500 660 590 575'), '#593923', 16);
    }
  }

  function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    const w = canvas.width, h = canvas.height, r = 110;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
  }

  function draw() {
    drawBackground();

    if (powered) {
      ctx.save();

      // Equivalente a preserveAspectRatio="xMidYMid meet".
      // Conserva las proporciones del viewBox 1000 × 850.
      // Encuadra el rostro sin deformar los ojos ni la sonrisa.
        const scale = Math.min(canvas.width / 1100, canvas.height / 680)*1.2;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-500, -490);

      if (expression === 'monkey') {
        drawMonkey();
      } else {
        drawEye('L');
        drawEye('R');
        drawMouth();
      }
      ctx.restore();
    }

    texture.needsUpdate = true;
  }

  function updateButtons() {
    options.querySelectorAll('[data-face]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.face === expression));
    });
  }

  model.setExpression = function(id) {
    if (!faces.some(face => face.id === id)) return;
    expression = id;
    mouthOpen = false;
    draw();
    updateButtons();
  };

  model.setFacePower = function(on) {
    powered = Boolean(on);
    originalFace.forEach(mesh => mesh.visible = false);
    draw();
  };

  // Preparado para una futura animación de habla.
  model.setFaceMouthOpen = function(open) {
    mouthOpen = Boolean(open);
    draw();
  };

  faces.forEach(face => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'face-choice';
    button.dataset.face = face.id;
    button.textContent = face.name;
    button.setAttribute('aria-pressed', String(face.id === expression));
    button.onclick = () => model.setExpression(face.id);
    options.appendChild(button);
  });

  document.querySelectorAll('#custom-clothes [data-outfit]').forEach(button => {
    button.addEventListener('click', () => {
      model.setExpression(button.dataset.outfit === 'monkey' ? 'monkey' : 'normal');
    });
  });

  const headClothing = document.querySelector('[data-clothing="head"]');
  if (headClothing) {
    headClothing.addEventListener('change', () => {
      if (headClothing.value === 'monkey') model.setExpression('monkey');
    });
  }

  let style = document.querySelector('#face-options-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'face-options-style';
    document.head.appendChild(style);
  }
  style.textContent = `
    #face-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}
    #custom-panel .face-choice{min-height:58px;padding:14px;border:1px solid #3d5d75;border-radius:12px;background:#183246;color:#e1eff9;font-size:16px;font-weight:650}
    #custom-panel .face-choice:hover{background:#254b65;border-color:#76bce9}
    #custom-panel .face-choice[aria-pressed="true"]{background:#24517a;border-color:#8ad4ff;box-shadow:inset 0 -3px #8ad4ff}
  `;

  draw();
};