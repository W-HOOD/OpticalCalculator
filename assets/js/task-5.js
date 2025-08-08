
const baseDpr = window.devicePixelRatio || 1;
const dpr = baseDpr * 3;
const cssSize = 600;
const internalSize = cssSize * dpr;

let imageX = 150;
let imageY = 0;
let mirrorLineX = 0;
let clipTexXLoc = null;
let isMirroredLoc = null;

const vertexShaderSource = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
out vec2 v_worldPos;
uniform mat3 u_matrix;
void main() {
  vec2 pos = (u_matrix * vec3(a_position, 1)).xy;
  v_worldPos = pos;
  gl_Position = vec4(pos, 0, 1);
  v_texCoord = a_texCoord;
}`;


const fragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_clipTexX;
uniform bool u_isMirrored;
out vec4 outColor;

void main() {
  float xCoord = v_texCoord.x;

  // If mirrored, flip clip condition
  if (u_clipTexX >= 0.0) {
    if (!u_isMirrored && xCoord < u_clipTexX) {
      discard;
    }
    if (u_isMirrored && xCoord > (1.0 - u_clipTexX)) {
      discard;
    }
  }

  outColor = texture(u_image, v_texCoord);
}
`;




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
  ctx.clearRect(0, 0, width, height);
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

function drawMirrorLine(ctx, canvasWidth, mirrorX) {
  const midX = canvasWidth / 2;
  const px = midX + mirrorX;
  ctx.beginPath();
  ctx.strokeStyle = "#c1b80f";
  ctx.lineWidth = 1;
  ctx.moveTo(px, 0);
  ctx.lineTo(px, canvasWidth);
  ctx.stroke();
}

function toClip(value) {
  return value / (cssSize / 2);
}

function getMirroredMatrixAroundX(mirrorX, imageX, imageY, scaleX, scaleY) {
  const originalCenterX = toClip(imageX);
  const mirroredCenterX = toClip(2 * mirrorX - imageX);
  return new Float32Array([
    -scaleX, 0, 0,
    0, scaleY, 0,
    mirroredCenterX, toClip(imageY), 1,
  ]);
}

function getTransformMatrix(centerX, centerY, scaleX, scaleY) {
  return new Float32Array([
    scaleX, 0, 0,
    0, scaleY, 0,
    toClip(centerX), toClip(centerY), 1
  ]);
}

function renderImages(gl, program, matrixLoc, texture, img, scaleFactor) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  gl.viewport(0, 0, internalSize, internalSize);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const half = cssSize / 2;
  const imgAspect = img.width / img.height;

  let renderWidth = (half) * scaleFactor;
  let renderHeight = renderWidth / imgAspect;

  if (renderHeight > (half) * scaleFactor) {
    renderHeight = (half) * scaleFactor;
    renderWidth = renderHeight * imgAspect;
  }

  const scaleX = renderWidth / half;
  const scaleY = renderHeight / half;

  const rightMatrix = getTransformMatrix(imageX, imageY, scaleX, scaleY);
  const leftMatrix = getMirroredMatrixAroundX(mirrorLineX, imageX, imageY, scaleX, scaleY);

  // Compute texture-space clip X for original image
  const imageLeft = imageX - renderWidth / 2;
  const imageRight = imageX + renderWidth / 2;

  let clipTexX = 0.0;
  if (mirrorLineX > imageLeft && mirrorLineX < imageRight) {
    const pixelsRightOfLeftEdge = mirrorLineX - imageLeft;
    const imageWidth = imageRight - imageLeft;
    clipTexX = pixelsRightOfLeftEdge / imageWidth;
  } else if (mirrorLineX <= imageLeft) {
    clipTexX = 0.0;
  } else {
    clipTexX = 1.1;
  }

  // Draw original (right) image with clipping
  gl.uniform1f(clipTexXLoc, clipTexX);
  gl.uniform1i(isMirroredLoc, 0);
  gl.uniformMatrix3fv(matrixLoc, false, rightMatrix);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Draw mirrored image with same clipping logic
  gl.uniform1f(clipTexXLoc, clipTexX);
  gl.uniform1i(isMirroredLoc, 1);
  gl.uniformMatrix3fv(matrixLoc, false, leftMatrix);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
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
  const mirrorSlider = document.getElementById("sliderMirrorLine");
  const mirrorLabel = document.getElementById("mirrorLineLabel");

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
  if (!gl) {
    alert("WebGL2 not supported.");
    return;
  }

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  gl.useProgram(program);

  const positionLoc = gl.getAttribLocation(program, "a_position");
  const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");
  const matrixLoc = gl.getUniformLocation(program, "u_matrix");
  clipTexXLoc = gl.getUniformLocation(program, "u_clipTexX");

  const positions = new Float32Array([
    -0.5, -0.5, 0.5, -0.5,
    -0.5,  0.5, -0.5, 0.5,
     0.5, -0.5, 0.5,  0.5,
  ]);
  const texCoords = new Float32Array([
    0, 1, 1, 1,
    0, 0, 0, 0,
    1, 1, 1, 0,
  ]);

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const texBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(texCoordLoc);
  gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  sliderScale.addEventListener("input", () => {
    scaleFactor = parseFloat(sliderScale.value) / 100;
    scaleLabel.textContent = sliderScale.value;
    if (uploadedImg) renderImages(gl, program, matrixLoc, texture, uploadedImg, scaleFactor);
  });

  sliderImageX.addEventListener("input", () => {
    imageX = parseFloat(sliderImageX.value);
    imageXLabel.textContent = sliderImageX.value;
    if (uploadedImg) renderImages(gl, program, matrixLoc, texture, uploadedImg, scaleFactor);
  });

  sliderImageY.addEventListener("input", () => {
    imageY = parseFloat(sliderImageY.value);
    imageYLabel.textContent = sliderImageY.value;
    if (uploadedImg) renderImages(gl, program, matrixLoc, texture, uploadedImg, scaleFactor);
  });

  mirrorSlider.addEventListener("input", () => {
    mirrorLineX = parseFloat(mirrorSlider.value);
    mirrorLabel.textContent = mirrorSlider.value;
    if (uploadedImg) renderImages(gl, program, matrixLoc, texture, uploadedImg, scaleFactor);

    const ctx = gridCanvas.getContext("2d");
    ctx.resetTransform();
    ctx.clearRect(0, 0, internalSize, internalSize);
    ctx.globalCompositeOperation = 'difference';
    ctx.scale(dpr, dpr);
    drawGrid(ctx, cssSize, cssSize, 50);
    drawMirrorLine(ctx, cssSize, mirrorLineX);
    ctx.globalCompositeOperation = 'source-over';
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      uploadedImg = img;
      renderImages(gl, program, matrixLoc, texture, img, scaleFactor);
      const ctx = gridCanvas.getContext("2d");
      ctx.resetTransform();
      ctx.clearRect(0, 0, internalSize, internalSize);
      ctx.globalCompositeOperation = 'difference';
      ctx.scale(dpr, dpr);
      drawGrid(ctx, cssSize, cssSize, 50);
      ctx.globalCompositeOperation = 'source-over';
      drawMirrorLine(ctx, cssSize, mirrorLineX);
    };
    img.src = URL.createObjectURL(file);
  });

  const defaultImg = new Image();
  defaultImg.onload = () => {
    uploadedImg = defaultImg;
    renderImages(gl, program, matrixLoc, texture, defaultImg, scaleFactor);
    const ctx = gridCanvas.getContext("2d");
    ctx.resetTransform();
    ctx.clearRect(0, 0, internalSize, internalSize);
    ctx.globalCompositeOperation = 'difference';
    ctx.scale(dpr, dpr);
    drawGrid(ctx, cssSize, cssSize, 50);
    ctx.globalCompositeOperation = 'source-over';
    drawMirrorLine(ctx, cssSize, mirrorLineX);
  };
  defaultImg.src = "assets/images/Thumbnail.png";
}

main();