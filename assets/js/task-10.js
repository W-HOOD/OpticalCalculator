const baseDpr = window.devicePixelRatio || 1;
const dpr = baseDpr * 3;
const cssSize = 600;
const internalSize = cssSize * dpr;

// Add these with your other global variables
let gridSize = 100;  // Adjust tessellation density
let indexBuffer;    // Will hold our index buffer
let indices = [];   // Will hold triangle indices
let vertexCount;    // Track total vertices

let transformationCenterX = 0;
let transformationCenterY = 0;

let renderWidth = 0;
let renderHeight = 0;


let imageX = 0;
let imageY = 0;
let mirrorX = 0;
let mirrorY = 0;
let radius = 50;
let angle = 1;
let scale = 1;

const vertexShaderSource = `#version 300 es
precision highp float;

in vec2 a_position;     // Original vertex position (-0.5 to 0.5)
in vec2 a_texCoord;     // Texture coordinate (0 to 1)
out vec2 v_texCoord;

uniform mat3 u_matrix;  // For untransformed image
uniform float u_imageX; // X position of image center (world space)
uniform float u_imageY; // Y position of image center (world space)
uniform float u_mirrorX;  // X position of mirror (world space)
uniform float u_mirrorY;  // Y position of mirror (world space)
uniform float u_radius; // Radius (world space)
uniform float u_angle; // Angle (world space)
uniform float u_scale;  // Scale factor of the original image
uniform float u_aspect; // Image aspect ratio (width / height)
uniform float u_transformCenterX; // Transformation center X (world space)
uniform float u_transformCenterY; // Transformation center Y (world space)
uniform bool u_applyMirror; // Whether to apply mirror transformation


void main() {
    v_texCoord = a_texCoord;

    // In the vertex shader, replace the mirror transformation part with:
    if (!u_applyMirror) {
        // Render original image (use u_matrix)
        vec2 pos = (u_matrix * vec3(a_position, 1)).xy;
        gl_Position = vec4(pos, 0, 1);
    } else {
        
        // 1. Normalized texture coordinates [0,1]
        vec2 texCoord = a_texCoord;

        // 2. Convert u_angle (degrees) to radians
        float angleRad = radians(u_angle);
        
        // 3. Center at 180° (south) with symmetric spread
        float centerAngle = 1.5 * 3.14159265; // 180° in radians
        float startAngle = centerAngle + angleRad/2.0; // Right side of arc
        float endAngle = centerAngle - angleRad/2.0;   // Left side of arc

        float baseOuterRadius = u_radius * 3.0 * sqrt(2.0); // Artist-recommended base multiplier
        float outerRadius = u_radius + (baseOuterRadius - u_radius) * u_scale;

        // 4. Map x-coordinate anti-clockwise (right → left)
        float angle = mix(endAngle, startAngle, texCoord.x);

        // 5. Map y-coordinate to radius (200 → u_radius)
        float radius = outerRadius - (texCoord.y * (outerRadius - u_radius));

        // 6. Convert to Cartesian coordinates
        vec2 polarPos = vec2(cos(angle), sin(angle)) * radius;

        // 7. Apply transformation center offset
        polarPos += vec2(u_transformCenterX, u_transformCenterY);

        // 8. Scale to clip space
        gl_Position = vec4(polarPos / 300.0, 0.0, 1.0);

    }
}
`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_image;
uniform bool u_applyMirror;
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

function drawArc(ctx, mirrorX, mirrorY, scale, radius, canvasSize, dpr) {
    const midX = canvasSize / 2;
    const midY = canvasSize / 2;

    const px = midX + mirrorX;
    const py = midY - mirrorY;

    let transformationCenterXctx = px;
    let transformationCenterYctx= py + 0.5 * renderHeight;

    ctx.save();
    
    // 1. Draw mirror outline (no fill)
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#c1b80f';
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, 2 * Math.PI, false);
    ctx.stroke();


    ctx.strokeStyle = '#c1b80f';

    drawCross(ctx, transformationCenterXctx, transformationCenterYctx, 5);
    

    ctx.restore();
}

// Helper function to draw '+' markers
function drawCross(ctx, x, y, size) {
  ctx.beginPath();
  // Diagonal line (top-left to bottom-right)
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  // Diagonal line (bottom-left to top-right)
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
    matrixLoc, texture, img, scale,
    imageXLoc, imageYLoc,
    mirrorXLoc, mirrorYLoc,
    radiusLoc, angleLoc, scaleLoc, transformCenterXLoc, transformCenterYLoc,
    aspectLoc, applyMirrorLoc
) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    gl.viewport(0, 0, internalSize, internalSize);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const half = cssSize / 2;
    const imgAspect = img.width / img.height;

    renderWidth = (radius / (0.5 * Math.sqrt((1 / ((imgAspect) ** 2)) + 1))) * scale;
    renderHeight = renderWidth / imgAspect;

    if (renderHeight > renderWidth) {
        renderHeight = (radius / (0.5 * Math.sqrt(((imgAspect) ** 2) + 1))) * scale;
        renderWidth = renderHeight * imgAspect;
    }

    transformationCenterX = mirrorX;
    transformationCenterY = mirrorY - 0.5 * renderHeight;

    imageX = mirrorX;
    imageY = mirrorY;

    const scaleX = (renderWidth / (scale * half)) * (angle / 360);
    const scaleY = renderHeight / half;
    const rightMatrix = getTransformMatrix(imageX, imageY, scaleX, scaleY);

    // --- Pass 1: Transformed Image (mirror Effect) ---
    gl.uniform1i(applyMirrorLoc, 1);  // Enable mirror transform
    gl.uniform1f(imageXLoc, imageX);
    gl.uniform1f(imageYLoc, imageY);
    gl.uniform1f(mirrorXLoc, mirrorX);
    gl.uniform1f(mirrorYLoc, mirrorY);
    gl.uniform1f(radiusLoc, radius);
    gl.uniform1f(angleLoc, angle);
    gl.uniform1f(scaleLoc, scale);
    gl.uniform1f(transformCenterXLoc, transformationCenterX);
    gl.uniform1f(transformCenterYLoc, transformationCenterY);
    gl.uniform1f(aspectLoc, imgAspect);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    // --- Pass 2: Original Image (No mirror) ---
    gl.uniform1i(applyMirrorLoc, 0);  // Disable mirror transform

    gl.uniformMatrix3fv(matrixLoc, false, rightMatrix);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
}

function updateGrid() {
    const ctx = gridCanvas.getContext("2d");
    ctx.resetTransform();
    ctx.clearRect(0, 0, internalSize, internalSize);
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = 'difference';
    drawGrid(ctx, cssSize, cssSize, 50);
    ctx.globalCompositeOperation = 'source-over';
    drawArc(ctx, mirrorX, mirrorY, scale, radius, cssSize, dpr);
}



function main() {
    const fileInput = document.getElementById("fileInput");
    const glCanvas = document.getElementById("glCanvas");
    const gridCanvas = document.getElementById("gridCanvas");
    const scaleSlider = document.getElementById("sliderScale");
    const scaleLabel = document.getElementById("scaleLabel");
    const radiusSlider = document.getElementById("sliderRadius");
    const radiusLabel = document.getElementById("radiusLabel");
    const sliderMirrorX = document.getElementById("sliderMirrorX");
    const sliderMirrorY = document.getElementById("sliderMirrorY");
    const mirrorXLabel = document.getElementById("mirrorXLabel");
    const mirrorYLabel = document.getElementById("mirrorYLabel");
    const angleSlider = document.getElementById("sliderAngle");
    const angleLabel = document.getElementById("angleLabel");

    angle = 360 * (parseFloat(angleSlider.value) / 100)


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
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Standard alpha blending
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
    const mirrorXLoc = gl.getUniformLocation(program, "u_mirrorX");
    const mirrorYLoc = gl.getUniformLocation(program, "u_mirrorY");
    const radiusLoc = gl.getUniformLocation(program, "u_radius");
    const scaleLoc = gl.getUniformLocation(program, "u_scale");
    const angleLoc = gl.getUniformLocation(program, "u_angle");
    const aspectLoc = gl.getUniformLocation(program, "u_aspect");    // New
    const transformCenterXLoc = gl.getUniformLocation(program, "u_transformCenterX"); // New
    const transformCenterYLoc = gl.getUniformLocation(program, "u_transformCenterY"); // New
    const applyMirrorLoc = gl.getUniformLocation(program, "u_applyMirror"); // New

    const renderImagesWithUniforms = (texture, img, scale) => {
        // Update the renderImagesWithUniforms call to match the function definition:
        renderImages(
            gl, program, 
            matrixLoc, texture, img, scale,
            imageXLoc, imageYLoc,
            mirrorXLoc, mirrorYLoc,
            radiusLoc, angleLoc, scaleLoc,
            transformCenterXLoc, transformCenterYLoc,
            aspectLoc, applyMirrorLoc
        );

    };

    // Replace the positions and texCoords arrays with:


    // Delete the old position/texCoord arrays and replace with:

    // Generate vertex grid
    const vertices = [];
    const texCoords = [];
    indices = []; // Reset indices

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

    // Update position buffer (keep the same buffer reference)
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Update texture coordinate buffer (keep the same buffer reference)
    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Create and bind index buffer (NEW)
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    scaleSlider.addEventListener("input", () => {
        scale = parseFloat(scaleSlider.value) / 100;
        scaleLabel.textContent = scaleSlider.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scale);
            updateGrid();
        }
    });

    radiusSlider.addEventListener("input", () => {
        radius = parseFloat(radiusSlider.value);
        radiusLabel.textContent = radiusSlider.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scale);
            updateGrid();
        }
    });

    sliderMirrorX.addEventListener("input", () => {
        mirrorX = parseFloat(sliderMirrorX.value);
        mirrorXLabel.textContent = sliderMirrorX.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scale);
            updateGrid();
        }
    });

    sliderMirrorY.addEventListener("input", () => {
        mirrorY = parseFloat(sliderMirrorY.value);
        mirrorYLabel.textContent = sliderMirrorY.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scale);
            updateGrid();
        }
    });

    angleSlider.addEventListener("input", () => {
        angle = 360 * (parseFloat(angleSlider.value) / 100)
        angleLabel.textContent = angleSlider.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scale);
            updateGrid();
        }
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            uploadedImg = img;
            renderImagesWithUniforms(texture, uploadedImg, scale);
            const ctx = gridCanvas.getContext("2d");
            ctx.resetTransform();
            ctx.clearRect(0, 0, internalSize, internalSize);
            ctx.scale(dpr, dpr);
            ctx.globalCompositeOperation = 'difference';
            drawGrid(ctx, cssSize, cssSize, 50);
            ctx.globalCompositeOperation = 'source-over';
            drawArc(ctx, mirrorX, mirrorY, scale, radius, cssSize, dpr);
        };
        img.src = URL.createObjectURL(file);
    });

    const defaultImg = new Image();
    defaultImg.onload = () => {
        uploadedImg = defaultImg;
        renderImagesWithUniforms(texture, uploadedImg, scale);
        const ctx = gridCanvas.getContext("2d");
        ctx.resetTransform();
        ctx.clearRect(0, 0, internalSize, internalSize);
        ctx.scale(dpr, dpr);
        ctx.globalCompositeOperation = 'difference';
        drawGrid(ctx, cssSize, cssSize, 50);
        ctx.globalCompositeOperation = 'source-over';
        drawArc(ctx, mirrorX, mirrorY, scale, radius, cssSize, dpr);
    };
    defaultImg.src = "assets/images/01-m416-lootprint.jpg";
}

main();