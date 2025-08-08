const baseDpr = window.devicePixelRatio || 1;
const dpr = baseDpr * 3;
const cssSize = 600;
const internalSize = cssSize * dpr;

// Add these with your other global variables
let gridSize = 40;  // Adjust tessellation density
let indexBuffer;    // Will hold our index buffer
let indices = [];   // Will hold triangle indices
let vertexCount;    // Track total vertices

let warningVisible = false;

let imageX = 100;
let imageY = 0;
let lensX = 0;
let lensY = 0;
let focalRange = 150;

const vertexShaderSource = `#version 300 es
precision highp float;

in vec2 a_position;     // Original vertex position (-0.5 to 0.5)
in vec2 a_texCoord;     // Texture coordinate (0 to 1)
out vec2 v_texCoord;

uniform mat3 u_matrix;  // For untransformed image
uniform float u_imageX; // X position of image center (world space)
uniform float u_imageY; // Y position of image center (world space)
uniform float u_lensX;  // X position of lens (world space)
uniform float u_lensY;  // Y position of lens (world space)
uniform float u_focalRange; // Focal length (world space)
uniform float u_scale;  // Scale factor of the original image
uniform float u_aspect; // Image aspect ratio (width / height)
uniform bool u_applyLens; // Whether to apply lens transformation

void main() {
    v_texCoord = a_texCoord;

    // In the vertex shader, replace the lens transformation part with:
    if (!u_applyLens) {
        // Render original image (use u_matrix)
        vec2 pos = (u_matrix * vec3(a_position, 1)).xy;
        gl_Position = vec4(pos, 0, 1);
    } else {
        // Convert vertex to world space (account for aspect ratio)
        // First, compute the scaled/translated world position
        vec2 worldPos = (u_matrix * vec3(a_position, 1)).xy;

        // We multiply by 600 to convert from [-0.5,0.5] to [-300,300] world space
        float worldX = (worldPos.x) * 300.0;
        float worldY = (worldPos.y) * 300.0;

        // Compute relative position to lens
        float dx = worldX - u_lensX;
        float dy = worldY - u_lensY;


        // Compute new position (relative to lens)

        float newX = (-1.0 * u_focalRange * dx) / (abs(dx) - u_focalRange + 0.0001);
        float newY = (dy * newX) / dx;

        newX = newX + u_lensX;
        newY = newY + u_lensY;

        // Convert to clip space (-1 to 1)
        gl_Position = vec4(
            newX / 300.0,  // 300 = half of 600 (canvas size)
            newY / 300.0,
            0.0,
            1.0
        );
    }
}
`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_image;
uniform bool u_applyLens;
out vec4 outColor;

void main() {
    outColor = texture(u_image, v_texCoord);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link failed:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function drawGrid(ctx, width, height, spacing = 50) {
  ctx.font = `10px monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const midX = width / 2;
  const midY = height / 2;

  for (let x = 0; x <= width; x += spacing) {
    ctx.beginPath();
    ctx.lineWidth = Math.abs(x - midX) < 1 ? 1 : 0.5;
    ctx.strokeStyle = Math.abs(x - midX) < 1 ? "white" : "#222";
    ctx.fillStyle = "white";
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    if (x !== midX) ctx.fillText((x - midX).toFixed(0), x + 2, midY + 2);
  }
  for (let y = 0; y <= height; y += spacing) {
    ctx.beginPath();
    ctx.lineWidth = Math.abs(y - midY) < 1 ? 1 : 0.5;
    ctx.strokeStyle = Math.abs(y - midY) < 1 ? "white" : "#222";
    ctx.fillStyle = "white";
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if (y !== midY) ctx.fillText((midY - y).toFixed(0), midX + 4, y + 2);
  }
}

function drawLens(ctx, lensX, lensY, focalRange, canvasSize, dpr) {
  const midX = canvasSize / 2;
  const midY = canvasSize / 2;

  const px = midX + lensX;
  const py = midY - lensY;

  ctx.save();
  
  // Draw lens outline
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#c1b80f';
  ctx.beginPath();
  ctx.ellipse(px, py, 10, 75, 0, 0, 2 * Math.PI);
  ctx.stroke();

  // Calculate focal points positions
  const focalLeftX = px - focalRange;
  const focalRightX = px + focalRange;

  // Dashed lines through focal points
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = '#535007ff';
  
  // Left focal line
  ctx.beginPath();
  ctx.moveTo(focalLeftX, 0);
  ctx.lineTo(focalLeftX, canvasSize);
  ctx.stroke();
  
  // Right focal line
  ctx.beginPath();
  ctx.moveTo(focalRightX, 0);
  ctx.lineTo(focalRightX, canvasSize);
  ctx.stroke();

  ctx.strokeStyle = '#c1b80f';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);

  drawCross(ctx, focalLeftX, py, 5);
  
  drawCross(ctx, focalRightX, py, 5);
  
  drawCross(ctx, px, py, 5);

  ctx.setLineDash([]);
  

  ctx.restore();
}


function drawCross(ctx, x, y, size) {
  ctx.beginPath();

  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);

  ctx.moveTo(x - size, y + size);
  ctx.lineTo(x + size, y - size);
  ctx.stroke();
}

function toClip(value) {
  return value / (cssSize / 2);
}

function getTransformMatrix(centerX, centerY, scaleX, scaleY) {
  return new Float32Array([
    scaleX, 0, 0,
    0, scaleY, 0,
    toClip(centerX), toClip(centerY), 1
  ]);
}

function renderImages(
    gl, program, 
    matrixLoc, texture, img, scaleFactor,
    imageXLoc, imageYLoc,
    lensXLoc, lensYLoc,
    focalLoc, scaleLoc,
    aspectLoc, applyLensLoc
) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    gl.viewport(0, 0, internalSize, internalSize);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const half = cssSize / 2;
    const imgAspect = img.width / img.height;

    // --- Pass 1: Original Image (No Lens) ---
    gl.uniform1f(aspectLoc, imgAspect);
    gl.uniform1i(applyLensLoc, 0);  // Disable lens transform

    let renderWidth = half * scaleFactor;
    let renderHeight = renderWidth / imgAspect;

    if (renderHeight > half * scaleFactor) {
        renderHeight = half * scaleFactor;
        renderWidth = renderHeight * imgAspect;
    }

    const scaleX = renderWidth / half;
    const scaleY = renderHeight / half;
    const rightMatrix = getTransformMatrix(imageX, imageY, scaleX, scaleY);

    gl.uniformMatrix3fv(matrixLoc, false, rightMatrix);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    // --- Pass 2: Transformed Image (Lens Effect) ---
    gl.uniform1i(applyLensLoc, 1);  // Enable lens transform
    gl.uniform1f(imageXLoc, imageX);
    gl.uniform1f(imageYLoc, imageY);
    gl.uniform1f(lensXLoc, lensX);
    gl.uniform1f(lensYLoc, lensY);
    gl.uniform1f(focalLoc, focalRange);
    gl.uniform1f(scaleLoc, scaleFactor);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    if (applyLensLoc) {
        console.log("Transformed rendering with:");
        console.log("imageX:", imageX, "lensX:", lensX);
        console.log("focalRange:", focalRange);
    }
}

function updateGrid() {
    const ctx = gridCanvas.getContext("2d");
    ctx.resetTransform();
    ctx.clearRect(0, 0, internalSize, internalSize);
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = 'source-over';
    drawLens(ctx, lensX, lensY, focalRange, cssSize, dpr);
    ctx.globalCompositeOperation = 'difference';
    drawGrid(ctx, cssSize, cssSize, 50);
}

function checkFocalIntersectionAndDrawWarning(img, scaleFactor) {
    const ctx = warningOverlay.getContext("2d");
    warningOverlay.width = internalSize;
    warningOverlay.height = internalSize;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, cssSize, cssSize);

    ctx.font = "700 24px Montserrat, sans-serif";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚠️ IMAGE OUTSIDE FOCAL RANGE", cssSize / 2, (cssSize / 2) - 16);

    ctx.font = "500 14px Montserrat, sans-serif";
    ctx.fillText("ADJUST SLIDERS TO MOVE IMAGE WITHIN FOCAL RANGE", cssSize / 2, (cssSize / 2) + 16);

    const imgAspect = img.width / img.height;

    let renderWidth = (cssSize / 2) * scaleFactor;
    let renderHeight = renderWidth / imgAspect;
    console.log(img.width);
    console.log(renderWidth);
    console.log(scaleFactor);
    if (renderHeight > (cssSize / 2) * scaleFactor) {
        renderHeight = (cssSize / 2) * scaleFactor;
        renderWidth = renderHeight * imgAspect;
    }

    const left = imageX - (renderWidth / 2);
    const right = imageX + (renderWidth / 2);

    console.log(imageX);

    const minFocalX = lensX - focalRange;
    const maxFocalX = lensX + focalRange;

    const intersects = (right > maxFocalX && left > minFocalX) || (right < maxFocalX && left < minFocalX);

    if (intersects) {
        // Only redraw warning visuals if now visible
        if (!warningVisible) {
            warningVisible = true;
            warningOverlay.style.opacity = 1;
        }

    } else if (warningVisible) {
        // Fade out overlay
        warningVisible = false;
        warningOverlay.style.opacity = 0;
    }
}


function main() {
    const fileInput = document.getElementById("fileInput");
    const glCanvas = document.getElementById("glCanvas");
    const gridCanvas = document.getElementById("gridCanvas");
    const sliderScale = document.getElementById("sliderScale");
    const scaleLabel = document.getElementById("scaleLabel");
    const sliderImageX = document.getElementById("sliderImageX");
    const sliderImageY = document.getElementById("sliderImageY");
    const imageXLabel = document.getElementById("imageXLabel");
    const imageYLabel = document.getElementById("imageYLabel");
    const focalSlider = document.getElementById("sliderFocalRange");
    const focalLabel = document.getElementById("focalRange");
    const sliderLensX = document.getElementById("sliderLensX");
    const sliderLensY = document.getElementById("sliderLensY");
    const lensXLabel = document.getElementById("lensXLabel");
    const lensYLabel = document.getElementById("lensYLabel");

    let scaleFactor = parseFloat(sliderScale.value) / 100;
    let uploadedImg = null;

    glCanvas.width = internalSize;
    glCanvas.height = internalSize;
    gridCanvas.width = internalSize;
    gridCanvas.height = internalSize;

    glCanvas.style.width = cssSize + "px";
    glCanvas.style.height = cssSize + "px";
    gridCanvas.style.width = cssSize + "px";
    gridCanvas.style.height = cssSize + "px";

    const gl = glCanvas.getContext("webgl2", { alpha: true });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (!gl) {
        alert("WebGL2 not supported.");
        return;
    }

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(program);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");
    const matrixLoc = gl.getUniformLocation(program, "u_matrix");
    const imageXLoc = gl.getUniformLocation(program, "u_imageX");
    const imageYLoc = gl.getUniformLocation(program, "u_imageY");
    const lensXLoc = gl.getUniformLocation(program, "u_lensX");
    const lensYLoc = gl.getUniformLocation(program, "u_lensY");
    const focalLoc = gl.getUniformLocation(program, "u_focalRange");
    const scaleLoc = gl.getUniformLocation(program, "u_scale");
    const aspectLoc = gl.getUniformLocation(program, "u_aspect");
    const applyLensLoc = gl.getUniformLocation(program, "u_applyLens");

    const renderImagesWithUniforms = (texture, img, scaleFactor) => {
        renderImages(
            gl, program, 
            matrixLoc, texture, img, scaleFactor,
            imageXLoc, imageYLoc,
            lensXLoc, lensYLoc,
            focalLoc, scaleLoc,
            aspectLoc, applyLensLoc
        );

        checkFocalIntersectionAndDrawWarning(img, scaleFactor);
    };


    // Generate vertex grid
    const vertices = [];
    const texCoords = [];
    indices = [];

    for (let y = 0; y <= gridSize; y++) {
        for (let x = 0; x <= gridSize; x++) {
            vertices.push(
                x/gridSize - 0.5,  // x position (-0.5 to 0.5)
                y/gridSize - 0.5   // y position (-0.5 to 0.5)
            );
            texCoords.push(
                x/gridSize,        // u texture coord
                1.0 - y/gridSize  // v texture coord (flipped)
            );
        }
    }

    // Generate triangle indices
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const i = y * (gridSize + 1) + x;
            indices.push(i, i + 1, i + gridSize + 1);
            indices.push(i + 1, i + gridSize + 2, i + gridSize + 1);
        }
    }

    vertexCount = indices.length; // Store total vertices

    // Update position buffer 
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Update texture coordinate buffer 
    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Create and bind index buffer 
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    sliderScale.addEventListener("input", () => {
        scaleFactor = parseFloat(sliderScale.value) / 100;
        scaleLabel.textContent = sliderScale.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
            updateGrid();
        }
    });

    sliderImageX.addEventListener("input", () => {
        imageX = parseFloat(sliderImageX.value);
        imageXLabel.textContent = sliderImageX.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
            updateGrid();
        }
    });

    sliderImageY.addEventListener("input", () => {
        imageY = parseFloat(sliderImageY.value);
        imageYLabel.textContent = sliderImageY.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
            updateGrid();
        }
    });

    focalSlider.addEventListener("input", () => {
        focalRange = parseFloat(focalSlider.value);
        focalLabel.textContent = focalSlider.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
            updateGrid();
        }
    });

    sliderLensX.addEventListener("input", () => {
        lensX = parseFloat(sliderLensX.value);
        lensXLabel.textContent = sliderLensX.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
            updateGrid();
        }
    });

    sliderLensY.addEventListener("input", () => {
        lensY = parseFloat(sliderLensY.value);
        lensYLabel.textContent = sliderLensY.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
            updateGrid();
        }
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            uploadedImg = img;
            renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
            updateGrid();
        };
        img.src = URL.createObjectURL(file);
    });

    const defaultImg = new Image();
    defaultImg.onload = () => {
        uploadedImg = defaultImg;
        renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
        updateGrid();
    };
    defaultImg.src = "assets/images/Thumbnail.png";
}

main();