let saturationOn = false;
let planeMesh;
let saturationTarget = 0.0;   // target saturation, 1 = full color, 0 = mostly grayscale


// Existing animation logic
async function loadAnimation() {
  const loadingContainer = document.querySelector('.loading-container');
  formatTextLines();
  wrapWords();

  loadingContainer.addEventListener('transitionend', () => {
    animateWords();
  });

  setupImageDistortion(); // Call the distortion setup
}

function formatTextLines() {
  const textOne = document.querySelector('.text-one');
  if (textOne) {
    textOne.innerHTML = `
      <div class="text-line">BPHO</div>
      <div class="text-line">COMPUTATIONAL</div>
      <div class="text-line">CHALLENGE</div>
      <div class="text-line">OPTICS 2025</div>
    `;
  }
}

function wrapWords() {
  const textLines = document.querySelectorAll('.text-line, .text-two');
  textLines.forEach(line => {
    const words = line.textContent.split(/(\s+)/);
    line.innerHTML = words.map(word =>
      word.trim()
        ? `<span class="word">${word}</span>`
        : `<span class="word-space">${word}</span>`
    ).join('');
  });
}

function animateWords() {
  const words = document.querySelectorAll('.word');
  const baseDelay = 0;
  const lineStagger = 0.2;
  const wordStagger = 0.1;
  let currentDelay = baseDelay;
  let currentLine = null;

  words.forEach((word) => {
    const line = word.closest('.text-line, .text-two');
    if (line !== currentLine) {
      currentLine = line;
      currentDelay += lineStagger;
    }
    word.style.transitionDelay = `${currentDelay}s`;
    word.style.opacity = '1';
    word.style.transform = 'translateY(0)';
    currentDelay += wordStagger;
  });

  // Trigger saturation fade-in after all words have animated
  const totalDuration = 2.8 * 1000;
  setTimeout(() => {
    saturationOn = true;
    saturationTarget = 0.8;
  }, totalDuration);
}

// Distortion effect setup
function setupImageDistortion() {
  const imageContainer = document.getElementById("imageContainer");
  const imageElement = document.getElementById("myImage") || imageContainer.querySelector("img");
  if (!imageContainer || !imageElement) return;

  let easeFactor = 0.04;
  let scene, camera, renderer;
  let mousePosition = { x: 0.5, y: 0.5 };
  let targetMousePosition = { x: 0.5, y: 0.5 };
  let prevPosition = { x: 0.5, y: 0.5 };
  let aberrationIntensity = 0.0;

  const GRID_PIXEL_SIZE = 30;

  // Vertex shader (pass UV and position)
  const vertexShader = `
    varying vec2 vUv;
    varying vec2 vPosition;

    void main() {
      vUv = uv;
      vPosition = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Fragment shader:
  // 1) Calculate square grid based on screen pixels (use gl_FragCoord.xy and GRID_PIXEL_SIZE)
  // 2) Compute distortion strength based on mouse distance in screen space
  // 3) Mix grayscale and color based on distortion strength
  // 4) Apply chromatic aberration offset based on mouse movement and distortion strength

  const fragmentShader = `
    varying vec2 vUv;
    varying vec2 vPosition;
    uniform sampler2D u_texture;
    uniform vec2 u_mouse;       // normalized mouse pos (0-1)
    uniform vec2 u_prevMouse;   // normalized prev mouse pos (0-1)
    uniform float u_aberrationIntensity;
    uniform vec2 u_resolution;
    uniform float u_gridPixelSize;
    uniform float u_saturationToggle;

    float luminance(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec2 fragCoord = vUv * u_resolution;


      // Grid cell index
      vec2 cell = floor(fragCoord / u_gridPixelSize);
      vec2 cellCenter = (cell + 0.5) * u_gridPixelSize;

      // Mouse positions in pixel coords (flip y for gl_FragCoord)
      vec2 mousePx = vec2(u_mouse.x * u_resolution.x, (1.0 - u_mouse.y) * u_resolution.y);
      vec2 prevMousePx = vec2(u_prevMouse.x * u_resolution.x, (1.0 - u_prevMouse.y) * u_resolution.y);

      // Distance from cell center to mouse (pixels)
      float dist = distance(cellCenter, mousePx);

      // Strength: more near mouse, max 150px radius
      float strength = smoothstep(200.0, 0.0, dist);

      // Mouse delta vector and length
      vec2 mouseDelta = mousePx - prevMousePx;
      float deltaLength = length(mouseDelta);

      // If mouse isn't moving much, reduce aberration intensity & strength
      float movementFactor = clamp(deltaLength * 100.0, 0.0, 1.0);

      // Final strength mixes spatial strength and movement
      strength *= movementFactor * u_aberrationIntensity;

      // UV distortion offset based on mouse movement and strength
      vec2 uvOffset = -mouseDelta * strength * 0.002;

      vec2 distortedUV = vUv + uvOffset;

      float aberr = strength * 0.08;

      // Sample channels with chromatic aberration
      vec4 colorR = texture2D(u_texture, distortedUV + vec2(aberr, 0.0));
      vec4 colorG = texture2D(u_texture, distortedUV);
      vec4 colorB = texture2D(u_texture, distortedUV - vec2(aberr, 0.0));

      vec3 color = vec3(colorR.r, colorG.g, colorB.b);

      // Grayscale base
      float gray = luminance(color);

      // Mix grayscale (default) and color (on distortion)
      vec3 finalColor = mix(vec3(gray), color, strength * (1.0 - u_saturationToggle));
      finalColor = mix(finalColor, color, u_saturationToggle);

      gl_FragColor = vec4(finalColor, 1.0);
    }

  `;


  function initializeScene(texture) {
    scene = new THREE.Scene();


    const width = window.innerWidth;
    const height = window.innerHeight;

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const planeGeometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      u_texture: { value: texture },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_prevMouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_aberrationIntensity: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_gridPixelSize: { value: GRID_PIXEL_SIZE },
      u_saturationToggle: { value: 0.0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
    });

    planeMesh = new THREE.Mesh(planeGeometry, material);
    scene.add(planeMesh);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    imageContainer.appendChild(renderer.domElement);

    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.zIndex = "-1";

    imageElement.style.display = "none";

    // Now that renderer exists, add mouse listener here:
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onWindowResize);
  }

  function onWindowResize() {
    if (!renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    planeMesh.material.uniforms.u_resolution.value.set(w, h);
  }

  function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    targetMousePosition.x = (event.clientX - rect.left) / rect.width;
    targetMousePosition.y = (event.clientY - rect.top) / rect.height;
  }

  function animate() {
    requestAnimationFrame(animate);

    mousePosition.x += (targetMousePosition.x - mousePosition.x) * easeFactor;
    mousePosition.y += (targetMousePosition.y - mousePosition.y) * easeFactor;

    const deltaX = targetMousePosition.x - prevPosition.x;
    const deltaY = targetMousePosition.y - prevPosition.y;
    const deltaLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    aberrationIntensity += deltaLength * 0.2;
    aberrationIntensity = Math.min(aberrationIntensity, 1.0);
    aberrationIntensity *= 0.9;

    planeMesh.material.uniforms.u_mouse.value.set(mousePosition.x, mousePosition.y);
    planeMesh.material.uniforms.u_prevMouse.value.set(prevPosition.x, prevPosition.y);
    planeMesh.material.uniforms.u_aberrationIntensity.value = aberrationIntensity;

    prevPosition.x += (mousePosition.x - prevPosition.x) * 0.1;
    prevPosition.y += (mousePosition.y - prevPosition.y) * 0.1;

    // Smoothly ease the saturation toggle uniform toward target
    const currentVal = planeMesh.material.uniforms.u_saturationToggle.value;
    const easeSpeed = 0.03; // smaller is slower
    planeMesh.material.uniforms.u_saturationToggle.value = currentVal + (saturationTarget - currentVal) * easeSpeed;


    renderer.render(scene, camera);
  }

  // Load texture and initialize scene + animation loop after
  const loader = new THREE.TextureLoader();
  loader.load(imageElement.src, (texture) => {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 16; // or renderer.capabilities.getMaxAnisotropy(), after renderer init

    initializeScene(texture);
    animate();
  });
}


// Start everything
loadAnimation();


window.addEventListener('click', () => {
  saturationOn = !saturationOn;
  saturationTarget = saturationOn ? 0.7 : 0.0;
});
