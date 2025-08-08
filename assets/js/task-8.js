const baseDpr = window.devicePixelRatio || 1;
const dpr = baseDpr * 3;
const cssSize = 600;
const internalSize = cssSize * dpr;

let gridSize = 40;  // Adjust tessellation density
let indexBuffer; 
let indices = [];
let vertexCount;

let warningVisible = false;

let imageX = 150;
let imageY = 0.001;
let mirrorX = 0;
let mirrorY = 0;
let radius = 200;

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
uniform float u_scale;  // Scale factor of the original image
uniform float u_aspect; // Image aspect ratio (width / height)
uniform bool u_applyMirror; // Whether to apply mirror transformation

void main() {
    v_texCoord = a_texCoord;

    // In the vertex shader, replace the mirror transformation part with:
    if (!u_applyMirror) {
        // Render original image (use u_matrix)
        vec2 pos = (u_matrix * vec3(a_position, 1)).xy;
        gl_Position = vec4(pos, 0, 1);
    } else {
        // Convert vertex to world space
        vec2 worldPos = (u_matrix * vec3(a_position, 1)).xy;

        float worldX = worldPos.x * 300.0;
        float worldY = worldPos.y * 300.0;

        vec2 P = vec2(worldX, worldY);          // Original pixel
        vec2 C = vec2(u_mirrorX, u_mirrorY);    // Mirror center (e.g., (0, 0))
        float R = u_radius;                     // Radius (e.g., 200)
        vec2 F = C - vec2(R * 0.5, 0.0);        // Focal point to the left

        // Step 1: Horizontal ray from P to mirror surface
        float dy = P.y - C.y;
        float yOffset = dy;
        float xOffset = sqrt(max(R * R - yOffset * yOffset, 0.0));
        vec2 Q = C - vec2(xOffset, 0.0) + vec2(0.0, yOffset); // On mirror arc (left side)

        // Step 2: Ray from Q to focal point F
        vec2 dir1 = normalize(F - Q);

        // Step 3: Ray from P through mirror center C
        vec2 dir2 = normalize(C - P);

        // Solve for intersection: Q + t1 * dir1 == P + t2 * dir2
        float denom = dir1.x * dir2.y - dir1.y * dir2.x;
        vec2 P_reflected;

        vec2 diff = P - Q;
        float t1 = (diff.x * dir2.y - diff.y * dir2.x) / denom;
        P_reflected = Q + t1 * dir1;

        // Convert to clip space
        gl_Position = vec4(P_reflected.x / 300.0, P_reflected.y / 300.0, 0.0, 1.0);

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

function drawArc(ctx, mirrorX, mirrorY, radius, canvasSize, dpr) {
    const midX = canvasSize / 2;
    const midY = canvasSize / 2;

    const px = midX + mirrorX;
    const py = midY - mirrorY;

    ctx.save();
    
    // 1. Draw mirror outline
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#c1b80f';
    ctx.beginPath();
    ctx.arc(px, py, radius, 0.5 * Math.PI, 1.5 * Math.PI, false);
    ctx.stroke();

    // Draw vertical dashed lines 
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = '#535007ff';
    
    ctx.beginPath();
    ctx.moveTo(px, py - radius);
    ctx.lineTo(canvasSize, py - radius);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px, py + radius);
    ctx.lineTo(canvasSize, py + radius);
    ctx.stroke();

    ctx.strokeStyle = '#074953ff';

    // Draw parabola
    const f = radius / 2;
    const a = 1 / (2 * radius);
    const step = 1;
    const yMin = mirrorY - radius;
    const yMax = mirrorY + radius;

    const xVertex = mirrorX - (radius / 2);

    ctx.beginPath();
    for (let y = yMin; y <= yMax; y += step) {
        const dy = y - mirrorY;
        const x = a * dy * dy + xVertex;

        const canvasX = midX + x;
        const canvasY = midY - y;

        if (y === yMin) {
            ctx.moveTo(canvasX, canvasY);
        } else {
            ctx.lineTo(canvasX, canvasY);
        }
    }

    ctx.stroke();

    ctx.strokeStyle = '#13aac2ff';
    ctx.setLineDash([]);

    drawCross(ctx, px - 0.5 * radius, py, 5);


    ctx.strokeStyle = '#c1b80f';
    ctx.lineWidth = 1;

    
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
    mirrorXLoc, mirrorYLoc,
    radiusLoc, scaleLoc,
    aspectLoc, applyMirrorLoc
) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    gl.viewport(0, 0, internalSize, internalSize);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const half = cssSize / 2;
    const imgAspect = img.width / img.height;

    // --- Pass 1: Original Image (No mirror) ---
    gl.uniform1f(aspectLoc, imgAspect);
    gl.uniform1i(applyMirrorLoc, 0);  // Disable mirror transform

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

    // --- Pass 2: Transformed Image (mirror Effect) ---
    gl.uniform1i(applyMirrorLoc, 1);  // Enable mirror transform
    gl.uniform1f(imageXLoc, imageX);
    gl.uniform1f(imageYLoc, imageY);
    gl.uniform1f(mirrorXLoc, mirrorX);
    gl.uniform1f(mirrorYLoc, mirrorY);
    gl.uniform1f(radiusLoc, radius);
    gl.uniform1f(scaleLoc, scaleFactor);

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
    drawArc(ctx, mirrorX, mirrorY, radius, cssSize, dpr);
}

function checkFocalIntersectionAndDrawWarning(img, scaleFactor) {
    const ctx = warningOverlay.getContext("2d");

    const imgAspect = img.width / img.height;

    let renderWidth = (cssSize / 2) * scaleFactor;
    let renderHeight = renderWidth / imgAspect;

    if (renderHeight > (cssSize / 2) * scaleFactor) {
        renderHeight = (cssSize / 2) * scaleFactor;
        renderWidth = renderHeight * imgAspect;
    }

    const left = imageX - (renderWidth / 2);
    const right = imageX + (renderWidth / 2);
    const top = imageY - (renderHeight / 2);
    const bottom = imageY + (renderHeight / 2);

    let outside = false;

    if (top < mirrorY - radius || bottom > mirrorY + radius) {
        outside = true;
    }

    if (!outside) {
        for (let y = top; y <= bottom; y += 1) {
            const dx = left - mirrorX;
            const dy = y - mirrorY;
            const distSq = dx * dx + dy * dy;

            if (left < mirrorX && distSq > radius * radius) {
                outside = true;
                break;
            }
        }
    }

    let intersects = false;
    const a = 1 / (2 * radius);
    const xVertex = mirrorX - (radius / 2);

    // Scan each y-slice of the image
    for (let y = top; y <= bottom; y += 1) {
        const dy = y - mirrorY;
        const xParabola = a * dy * dy + xVertex;

        // If any part of the image is on or to the left of the parabola
        if (left <= xParabola && right >= xParabola) {
            intersects = true;
            break;
        }
    }




    if (outside || intersects) {
        warningOverlay.width = internalSize;
        warningOverlay.height = internalSize;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, cssSize, cssSize);

        ctx.font = "700 24px Montserrat, sans-serif";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (outside) {
            ctx.fillText("⚠️ IMAGE OUTSIDE RAYTRACABLE AREA", cssSize / 2, (cssSize / 2) - 16);
            ctx.font = "500 14px Montserrat, sans-serif";
            ctx.fillText("ADJUST SLIDERS TO MOVE IMAGE WITHIN RAYTRACABLE AREA", cssSize / 2, (cssSize / 2) + 16);
        } else if (intersects) {
            ctx.fillText("⚠️ IMAGE OVERLAPS FOCAL PARABOLA", cssSize / 2, (cssSize / 2) - 16);
            ctx.font = "500 14px Montserrat, sans-serif";
            ctx.fillText("ADJUST SLIDERS TO MOVE IMAGE AWAY FROM FOCAL PARABOLA", cssSize / 2, (cssSize / 2) + 16);
        }

        warningVisible = true;
        warningOverlay.style.opacity = 1;

    } else {
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
    const radiusSlider = document.getElementById("sliderRadius");
    const radiusLabel = document.getElementById("radiusLabel");
    const sliderMirrorX = document.getElementById("sliderMirrorX");
    const sliderMirrorY = document.getElementById("sliderMirrorY");
    const mirrorXLabel = document.getElementById("mirrorXLabel");
    const mirrorYLabel = document.getElementById("mirrorYLabel");

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
    const mirrorXLoc = gl.getUniformLocation(program, "u_mirrorX");
    const mirrorYLoc = gl.getUniformLocation(program, "u_mirrorY");
    const radiusLoc = gl.getUniformLocation(program, "u_radius");
    const scaleLoc = gl.getUniformLocation(program, "u_scale");
    const aspectLoc = gl.getUniformLocation(program, "u_aspect");
    const applyMirrorLoc = gl.getUniformLocation(program, "u_applyMirror");
    const renderImagesWithUniforms = (texture, img, scaleFactor) => {
        renderImages(
            gl, program, 
            matrixLoc, texture, img, scaleFactor,
            imageXLoc, imageYLoc,
            mirrorXLoc, mirrorYLoc,
            radiusLoc, scaleLoc,
            aspectLoc, applyMirrorLoc
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

    radiusSlider.addEventListener("input", () => {
        radius = parseFloat(radiusSlider.value);
        radiusLabel.textContent = radiusSlider.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
            updateGrid();
        }
    });

    sliderMirrorX.addEventListener("input", () => {
        mirrorX = parseFloat(sliderMirrorX.value);
        mirrorXLabel.textContent = sliderMirrorX.value;
        if (uploadedImg) {
            renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
            updateGrid();
        }
    });

    sliderMirrorY.addEventListener("input", () => {
        mirrorY = parseFloat(sliderMirrorY.value);
        mirrorYLabel.textContent = sliderMirrorY.value;
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
            const ctx = gridCanvas.getContext("2d");
            ctx.resetTransform();
            ctx.clearRect(0, 0, internalSize, internalSize);
            ctx.scale(dpr, dpr);
            ctx.globalCompositeOperation = 'difference';
            drawGrid(ctx, cssSize, cssSize, 50);
            ctx.globalCompositeOperation = 'source-over';
            drawArc(ctx, mirrorX, mirrorY, radius, cssSize, dpr);
        };
        img.src = URL.createObjectURL(file);
    });

    const defaultImg = new Image();
    defaultImg.onload = () => {
        uploadedImg = defaultImg;
        renderImagesWithUniforms(texture, uploadedImg, scaleFactor);
        const ctx = gridCanvas.getContext("2d");
        ctx.resetTransform();
        ctx.clearRect(0, 0, internalSize, internalSize);
        ctx.scale(dpr, dpr);
        ctx.globalCompositeOperation = 'difference';
        drawGrid(ctx, cssSize, cssSize, 50);
        ctx.globalCompositeOperation = 'source-over';
        drawArc(ctx, mirrorX, mirrorY, radius, cssSize, dpr);
    };
    defaultImg.src = "assets/images/Thumbnail.png";
}

main();