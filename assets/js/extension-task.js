// === Global Variables ===
let currentMode = 1;
let showCorrectionLens = false;

let warningVisible = false;


const baseDpr = window.devicePixelRatio || 1;
const dpr = baseDpr * 3;
const cssSize = 600;
const internalSize = cssSize * dpr;

// === Shared Constants ===

let lensX1 = -50;
let focalRange1 = 100;
let lensX2 = -50;
let focalRange2 = 200;

function switchMode(newMode) {
    if (newMode === currentMode) return;

    warningVisible = false;


    const gridCanvas = document.getElementById('gridCanvas');
    const ctx = gridCanvas.getContext('2d');
    ctx.resetTransform();
    ctx.clearRect(0, 0, internalSize, internalSize);

    showCorrectionLens = false;

    const lensXLabel = document.getElementById('lensXValue');
    const focalRangeLabel = document.getElementById('focalRangeValue');

    const lensXSlider = document.getElementById('sliderLensX');
    const focalRangeSlider = document.getElementById('sliderFocalRange');

    if (newMode === 1) {
        if (lensXLabel) lensXLabel.textContent = lensX1.toFixed(1);
        if (lensXSlider) lensXSlider.value = lensX1;

        if (focalRangeLabel) focalRangeLabel.textContent = focalRange1.toFixed(1);
        if (focalRangeSlider) {
            focalRangeSlider.min = 50;
            focalRangeSlider.max = 300;
            focalRangeSlider.value = focalRange1;
        }

    } else if (newMode === 2) {
        if (lensXLabel) lensXLabel.textContent = lensX2.toFixed(1);
        if (lensXSlider) lensXSlider.value = lensX2;

        if (focalRangeLabel) focalRangeLabel.textContent = focalRange2.toFixed(1);
        if (focalRangeSlider) {
            focalRangeSlider.min = 50;
            focalRangeSlider.max = 300;
            focalRangeSlider.value = focalRange2;
        }

    }

    

    // Remove active-mode from all labels
    document.querySelectorAll('.mode-toggle').forEach(label => {
        label.classList.remove('active-mode');
    });

    // Find the label associated with the button for the newMode
    const activeLabel = document.querySelector(`label[for="modeToggle${newMode}"]`);
    if (activeLabel) {
        activeLabel.classList.add('active-mode');
    } else {
        console.warn(`Label for modeToggle${newMode} not found!`);
    }


    document.querySelectorAll('.lens-button').forEach(el => el.classList.remove('active-mode'));


    // Hide all mode elements
    document.querySelectorAll('.modeOneShow, .modeTwoShow').forEach(el => {
        el.style.display = 'none';
    });


    // Show elements and load graphs
    switch (newMode) {
        case 1:
            document.querySelectorAll('.modeOneShow').forEach(el => el.style.display = '');
            loadTaskACanvas();
            break;
        case 2:
            document.querySelectorAll('.modeTwoShow').forEach(el => el.style.display = '');
            if (typeof loadTaskBCanvas === 'function') loadTaskBCanvas();
            break;
    }

    currentMode = newMode;
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
    ctx.strokeStyle = Math.abs(x - midX) < 1 ? "black" : "#DDDDDD";
    ctx.fillStyle = "black";
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    if (x !== midX) ctx.fillText((x - midX).toFixed(0), x + 2, midY + 2);
  }
  for (let y = 0; y <= height; y += spacing) {
    ctx.beginPath();
    ctx.lineWidth = Math.abs(y - midY) < 1 ? 1 : 0.5;
    ctx.strokeStyle = Math.abs(y - midY) < 1 ? "black" : "#DDDDDD";
    ctx.fillStyle = "black";
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if (y !== midY) ctx.fillText((midY - y).toFixed(0), midX + 4, y + 2);
  }
}

function drawCross(ctx, x, y, size) {
  ctx.beginPath();

  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);

  ctx.moveTo(x - size, y + size);
  ctx.lineTo(x + size, y - size);
  ctx.stroke();
}

function updateValuesAndChart() {

    const lensXLabel = document.getElementById('lensXValue');
    const focalRangeLabel = document.getElementById('focalRangeValue');

    if (currentMode === 1) {
        if (lensXLabel) lensXLabel.textContent = lensX1.toFixed(1);
        if (focalRangeLabel) focalRangeLabel.textContent = focalRange1.toFixed(1);
    } else if (currentMode === 2) {
        if (lensXLabel) lensXLabel.textContent = lensX2.toFixed(1);
        if (focalRangeLabel) focalRangeLabel.textContent = focalRange2.toFixed(1);
    }
    

    switch (currentMode) {
        case 1: loadTaskACanvas(); break;
        case 2: loadTaskBCanvas(); break;
    }
}




// === Chart Loader ===
function loadTaskACanvas() {
    const gridCanvas = document.getElementById('gridCanvas');
    gridCanvas.width = internalSize;
    gridCanvas.height = internalSize;
    gridCanvas.style.width = cssSize + 'px';
    gridCanvas.style.height = cssSize + 'px';

    const ctx = gridCanvas.getContext('2d');
    ctx.resetTransform();
    ctx.clearRect(0, 0, internalSize, internalSize);
    ctx.globalCompositeOperation = 'source-over';
    ctx.scale(dpr, dpr);

    const cx = cssSize / 2;
    const cy = cssSize / 2;

    ctx.translate(cx, cy);

    // Eye parameters
    const eyeRadius = 100;
    const eyeCenterX = 150;
    const eyeCenterY = 0;

    // Draw eye arc with left-facing cutout
    ctx.beginPath();
    ctx.arc(eyeCenterX, eyeCenterY, eyeRadius, Math.PI * 0.85, Math.PI * -0.85, true);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw eye lens inside the cutout
    const lensWidth = 20;
    const lensHeight = 90;
    const eyeLensX = eyeCenterX - eyeRadius + lensWidth / 2;

    ctx.beginPath();
    ctx.ellipse(
        eyeLensX,
        eyeCenterY,
        lensWidth / 2,
        lensHeight / 2,
        0, 0, Math.PI * 2
    );
    ctx.fillStyle = 'rgba(100, 100, 255, 0)';
    ctx.strokeStyle = '#3e47f0';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // === Draw 3 Parallel Rays Converging Early (myopia) ===
    const rayStartX = -300;
    const focalLength = 140;
    const retinaX = eyeCenterX + eyeRadius;
    const retinaY = 0;
    const rayYs = [-15, 0, 15];

    const virtualFocalX = lensX1 - focalRange1;

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;

    let topRayLine = null;
    let bottomRayLine = null;


    rayYs.forEach(y => {
        const eyeLensX = eyeCenterX - eyeRadius + 10;
        const convergenceY = 0;
        const rayStartX = -300;

        if (!showCorrectionLens) {
            // === Uncorrected rays ===
            ctx.beginPath();
            ctx.moveTo(rayStartX, y);
            ctx.lineTo(eyeLensX, y);
            ctx.stroke();

            const convergenceX = eyeLensX + focalLength;

            const dx = convergenceX - eyeLensX;
            const dy = convergenceY - y;

            // Eye boundary intersection
            const A = dx * dx + dy * dy;
            const B = 2 * (dx * (eyeLensX - eyeCenterX) + dy * (y - eyeCenterY));
            const C = (eyeLensX - eyeCenterX) ** 2 + (y - eyeCenterY) ** 2 - eyeRadius ** 2;

            let tIntersection = null;
            const disc = B * B - 4 * A * C;
            if (disc >= 0) {
                const sqrtDisc = Math.sqrt(disc);
                const t1 = (-B + sqrtDisc) / (2 * A);
                const t2 = (-B - sqrtDisc) / (2 * A);
                const validTs = [t1, t2].filter(t => t > 0);
                if (validTs.length > 0) tIntersection = Math.min(...validTs);
            }

            const endX = tIntersection !== null ? eyeLensX + dx * tIntersection : convergenceX;
            const endY = tIntersection !== null ? y + dy * tIntersection : convergenceY;

            ctx.beginPath();
            ctx.moveTo(eyeLensX, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            if (y === 0) {
                ctx.strokeStyle = 'red';
                drawCross(ctx, eyeLensX + focalLength, 0, 7);
                ctx.strokeStyle = 'black';
            }
        } else {


            // === Corrected rays ===
            // === Part 1: Draw horizontal parallel ray from left to concave lens ===
            ctx.beginPath();
            ctx.moveTo(rayStartX, y);
            ctx.lineTo(lensX1, y); // stop at lens center
            ctx.stroke();

            // === Part 2: Draw diverging ray from lens to eye lens ===

            const dx = lensX1 - virtualFocalX;
            const dy = y - y;


            const dxVirtualToLens = lensX1 - virtualFocalX;
            const dxVirtualToEyeLens = eyeLensX - virtualFocalX;

            const scaleFactor = dxVirtualToEyeLens / dxVirtualToLens;
            const eyeIncomingY = y * scaleFactor;


            // Draw diverging ray
            ctx.beginPath();
            ctx.moveTo(lensX1, y);
            ctx.lineTo(eyeLensX, eyeIncomingY);
            ctx.stroke();

            if (eyeIncomingY > 44) {
                warningVisible = true;
            } else {
                warningVisible = false;
            }

            // === Part 3: Converging ray after the eye lens ===


            let slope;
            if (y === 0) slope = 0;
            else slope = -y / (eyeRadius * 1); 

            // Compute direction vector
            const dx2 = 1;
            const dy2 = slope;

            // Same intersection logic with eye boundary
            const A = dx2 * dx2 + dy2 * dy2;
            const B = 2 * (dx2 * (eyeLensX - eyeCenterX) + dy2 * (eyeIncomingY - eyeCenterY));
            const C = (eyeLensX - eyeCenterX) ** 2 + (eyeIncomingY - eyeCenterY) ** 2 - eyeRadius ** 2;

            let tIntersection = null;
            const disc = B * B - 4 * A * C;
            if (disc >= 0) {
                const sqrtDisc = Math.sqrt(disc);
                const t1 = (-B + sqrtDisc) / (2 * A);
                const t2 = (-B - sqrtDisc) / (2 * A);
                const validTs = [t1, t2].filter(t => t > 0);
                if (validTs.length > 0) tIntersection = Math.min(...validTs);
            }

            const endX = tIntersection !== null ? eyeLensX + dx2 * tIntersection : eyeLensX + 100;
            const endY = tIntersection !== null ? eyeIncomingY + dy2 * tIntersection : eyeIncomingY + dy2 * 100;

            // Draw final ray segment inside the eye
            ctx.beginPath();
            ctx.moveTo(eyeLensX, eyeIncomingY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            if (y === -15) {
                topRayLine = {
                    x: eyeLensX,
                    y: eyeIncomingY,
                    slope: slope
                };
            }
            if (y === 15) {
                bottomRayLine = {
                    x: eyeLensX,
                    y: eyeIncomingY,
                    slope: slope
                };
            }



        }
    });





    if (!showCorrectionLens) {
        ctx.strokeStyle = 'red';
        drawCross(ctx, eyeLensX + focalLength, 0, 7);
    }
    ctx.strokeStyle = 'blue';
    drawCross(ctx, retinaX, retinaY, 7);


    if (showCorrectionLens) {
        const midX = lensX1;
        const lensHeight = 90;
        const lensWidth = 15;

        const topY = -lensHeight / 2;
        const bottomY = lensHeight / 2;

        ctx.save();
        ctx.beginPath();

        // Left side
        ctx.moveTo(midX - lensWidth / 2, topY);
        ctx.bezierCurveTo(
            midX - lensWidth / 4, topY + lensHeight / 3,
            midX - lensWidth / 4, bottomY - lensHeight / 3,
            midX - lensWidth / 2, bottomY
        );

        // Bottom line
        ctx.lineTo(midX + lensWidth / 2, bottomY);

        // Right side
        ctx.bezierCurveTo(
            midX + lensWidth / 4, bottomY - lensHeight / 3,
            midX + lensWidth / 4, topY + lensHeight / 3,
            midX + lensWidth / 2, topY
        );

        ctx.closePath();

        ctx.strokeStyle = 'green';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(0, 255, 0, 0)';
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // === Draw two focal points ===
        ctx.strokeStyle = 'green';
        const focusOffset = focalRange1;

        drawCross(ctx, midX + focusOffset, 0, 7);

        drawCross(ctx, midX - focusOffset, 0, 7);
    }


    // === Compute true convergence point of eye rays (corrected case) ===
    if (showCorrectionLens && topRayLine && bottomRayLine) {
        const { x: x1, y: y1, slope: m1 } = topRayLine;
        const { x: x2, y: y2, slope: m2 } = bottomRayLine;

        if (m1 !== m2) {
            const convergeX = (m1 * x1 - m2 * x2 + y2 - y1) / (m1 - m2);
            const convergeY = m1 * (convergeX - x1) + y1;

            ctx.strokeStyle = 'red';
            drawCross(ctx, convergeX, convergeY, 7);
            console.log("Red cross at:", convergeX.toFixed(2), convergeY.toFixed(2));
            ctx.strokeStyle = 'black';
        }
    }

    const warningctx = warningOverlay.getContext("2d");
    warningOverlay.width = internalSize;
    warningOverlay.height = internalSize;
    warningctx.scale(dpr, dpr);

    warningctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    warningctx.fillRect(0, 0, cssSize, cssSize);

    warningctx.font = "700 24px Montserrat, sans-serif";
    warningctx.fillStyle = "white";
    warningctx.textAlign = "center";
    warningctx.textBaseline = "middle";
    warningctx.fillText("⚠️ LIGHT RAYS OUTSIDE PUPIL OPENING", cssSize / 2, (cssSize / 2) - 16);

    warningctx.font = "500 14px Montserrat, sans-serif";
    warningctx.fillText("ADJUST SLIDERS TO MOVE LIGHT RAYS WITHIN PUPIL OPENING", cssSize / 2, (cssSize / 2) + 16);


    // Reset transform and draw grid on top
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    drawGrid(ctx, cssSize, cssSize, 50);


    if (warningVisible) {
        warningOverlay.style.opacity = 1;

    } else {
        warningOverlay.style.opacity = 0;
    }

}


function loadTaskBCanvas() {
    const gridCanvas = document.getElementById('gridCanvas');
    gridCanvas.width = internalSize;
    gridCanvas.height = internalSize;
    gridCanvas.style.width = cssSize + 'px';
    gridCanvas.style.height = cssSize + 'px';

    const ctx = gridCanvas.getContext('2d');
    ctx.resetTransform();
    ctx.clearRect(0, 0, internalSize, internalSize);
    ctx.globalCompositeOperation = 'source-over';
    ctx.scale(dpr, dpr);

    const cx = cssSize / 2;
    const cy = cssSize / 2;

    ctx.translate(cx, cy);

    // Eye parameters
    const eyeRadius = 100;
    const eyeCenterX = 150;
    const eyeCenterY = 0;

    // Eye arc
    ctx.beginPath();
    ctx.arc(eyeCenterX, eyeCenterY, eyeRadius, Math.PI * 0.85, Math.PI * -0.85, true);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eye lens
    const lensWidth = 20;
    const lensHeight = 90;
    const eyeLensX = eyeCenterX - eyeRadius + lensWidth / 2;

    ctx.beginPath();
    ctx.ellipse(eyeLensX, eyeCenterY, lensWidth / 2, lensHeight / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 100, 255, 0)';
    ctx.strokeStyle = '#3e47f0';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // Rays
    const rayStartX = -300;
    const focalLength = 240;
    const retinaX = eyeCenterX + eyeRadius;
    const retinaY = 0;
    const rayYs = [-15, 0, 15];

    const virtualFocalX = lensX2 - focalRange2;

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;

    let topRayLine = null;
    let bottomRayLine = null;

    rayYs.forEach(y => {
        const eyeLensX = eyeCenterX - eyeRadius + 10;
        const convergenceY = 0;

        if (!showCorrectionLens) {
            ctx.beginPath();
            ctx.moveTo(rayStartX, y);
            ctx.lineTo(eyeLensX, y);
            ctx.stroke();

            const convergenceX = eyeLensX + focalLength;

            const dx = convergenceX - eyeLensX;
            const dy = convergenceY - y;

            const A = dx * dx + dy * dy;
            const B = 2 * (dx * (eyeLensX - eyeCenterX) + dy * (y - eyeCenterY));
            const C = (eyeLensX - eyeCenterX) ** 2 + (y - eyeCenterY) ** 2 - eyeRadius ** 2;

            let tIntersection = null;
            const disc = B * B - 4 * A * C;
            if (disc >= 0) {
                const sqrtDisc = Math.sqrt(disc);
                const t1 = (-B + sqrtDisc) / (2 * A);
                const t2 = (-B - sqrtDisc) / (2 * A);
                const validTs = [t1, t2].filter(t => t > 0);
                if (validTs.length > 0) tIntersection = Math.min(...validTs);
            }

            const endX = tIntersection !== null ? eyeLensX + dx * tIntersection : convergenceX;
            const endY = tIntersection !== null ? y + dy * tIntersection : convergenceY;

            ctx.beginPath();
            ctx.moveTo(eyeLensX, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            if (y === 0) {
                ctx.strokeStyle = 'red';
                drawCross(ctx, eyeLensX + focalLength, 0, 7);
                ctx.strokeStyle = 'black';
            }
        } else {
            ctx.beginPath();
            ctx.moveTo(rayStartX, y);
            ctx.lineTo(lensX2, y);
            ctx.stroke();

            const realFocalX = lensX2 + focalRange2;
            const dxLensToFocal = realFocalX - lensX2;
            const dxEyeLensToFocal = realFocalX - eyeLensX;

            const scaleFactor = dxEyeLensToFocal / dxLensToFocal;
            const eyeIncomingY = y * scaleFactor;

            ctx.beginPath();
            ctx.moveTo(lensX2, y);
            ctx.lineTo(eyeLensX, eyeIncomingY);
            ctx.stroke();


            if (eyeIncomingY > 44) {
                warningVisible = true;
            } else {
                warningVisible = false;
            }

            let slope;
            if (y === 0) slope = 0;
            else slope = -y / (eyeRadius * 4);

            const dx2 = 1;
            const dy2 = slope;

            const A = dx2 * dx2 + dy2 * dy2;
            const B = 2 * (dx2 * (eyeLensX - eyeCenterX) + dy2 * (eyeIncomingY - eyeCenterY));
            const C = (eyeLensX - eyeCenterX) ** 2 + (eyeIncomingY - eyeCenterY) ** 2 - eyeRadius ** 2;

            let tIntersection = null;
            const disc = B * B - 4 * A * C;
            if (disc >= 0) {
                const sqrtDisc = Math.sqrt(disc);
                const t1 = (-B + sqrtDisc) / (2 * A);
                const t2 = (-B - sqrtDisc) / (2 * A);
                const validTs = [t1, t2].filter(t => t > 0);
                if (validTs.length > 0) tIntersection = Math.min(...validTs);
            }

            const endX = tIntersection !== null ? eyeLensX + dx2 * tIntersection : eyeLensX + 100;
            const endY = tIntersection !== null ? eyeIncomingY + dy2 * tIntersection : eyeIncomingY + dy2 * 100;

            ctx.beginPath();
            ctx.moveTo(eyeLensX, eyeIncomingY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            if (y === -15) {
                topRayLine = { x: eyeLensX, y: eyeIncomingY, slope: slope };
            }
            if (y === 15) {
                bottomRayLine = { x: eyeLensX, y: eyeIncomingY, slope: slope };
            }
        }
    });

    if (!showCorrectionLens) {
        ctx.strokeStyle = 'red';
        drawCross(ctx, eyeLensX + focalLength, 0, 7);
    }
    ctx.strokeStyle = 'blue';
    drawCross(ctx, retinaX, retinaY, 7);

    if (showCorrectionLens) {
        const midX = lensX2;
        const lensHeight = 90;
        const lensWidth = 10;

        const topY = -lensHeight / 2;
        const bottomY = lensHeight / 2;

        ctx.save();
        ctx.beginPath();

        // Left side
        ctx.moveTo(midX - lensWidth / 2, topY);
        ctx.bezierCurveTo(
            midX - lensWidth, topY + lensHeight / 3,
            midX - lensWidth, bottomY - lensHeight / 3,
            midX - lensWidth / 2, bottomY
        );

        // Bottom line
        ctx.lineTo(midX + lensWidth / 2, bottomY);

        // Right side
        ctx.bezierCurveTo(
            midX + lensWidth, bottomY - lensHeight / 3,
            midX + lensWidth, topY + lensHeight / 3,
            midX + lensWidth / 2, topY
        );

        ctx.closePath();

        ctx.strokeStyle = 'green';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(0, 255, 0, 0)';
        ctx.fill();
        ctx.stroke();
        ctx.restore();


        // Focal points
        ctx.strokeStyle = 'green';
        const focusOffset = focalRange2;

        drawCross(ctx, midX + focusOffset, 0, 7);
        drawCross(ctx, midX - focusOffset, 0, 7);
    }

    if (showCorrectionLens && topRayLine && bottomRayLine) {
        const { x: x1, y: y1, slope: m1 } = topRayLine;
        const { x: x2, y: y2, slope: m2 } = bottomRayLine;

        if (m1 !== m2) {
            const convergeX = (m1 * x1 - m2 * x2 + y2 - y1) / (m1 - m2);
            const convergeY = m1 * (convergeX - x1) + y1;

            ctx.strokeStyle = 'red';
            drawCross(ctx, convergeX, convergeY, 7);
            ctx.strokeStyle = 'black';

            if (convergeX <= eyeLensX) {
                warningVisible = true;
            } else {
                warningVisible = false;
            }

        }
    }

    const warningctx = warningOverlay.getContext("2d");
    warningOverlay.width = internalSize;
    warningOverlay.height = internalSize;
    warningctx.scale(dpr, dpr);

    warningctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    warningctx.fillRect(0, 0, cssSize, cssSize);

    warningctx.font = "700 24px Montserrat, sans-serif";
    warningctx.fillStyle = "white";
    warningctx.textAlign = "center";
    warningctx.textBaseline = "middle";
    warningctx.fillText("⚠️ LIGHT RAYS CONVERGE OUTSIDE THE EYE", cssSize / 2, (cssSize / 2) - 16);

    warningctx.font = "500 14px Montserrat, sans-serif";
    warningctx.fillText("ADJUST SLIDERS TO CONVERGE LIGHT RAYS INSIDE THE EYE", cssSize / 2, (cssSize / 2) + 16);

    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    drawGrid(ctx, cssSize, cssSize, 50);

    if (warningVisible) {
        warningOverlay.style.opacity = 1;

    } else {
        warningOverlay.style.opacity = 0;
    }

}





// === Initialization ===
window.onload = () => {

    const activeLabel = document.querySelector(`label[for="modeToggle${currentMode}"]`);
    activeLabel.classList.add('active-mode');

    const nav = document.querySelector('.mode-toggle-wrapper');
    const links = nav.querySelectorAll('.fade');


    links.forEach(link => {
        link.addEventListener('mouseenter', () => {
            if (link.classList.contains('hover-underline')) {
                link.style.setProperty('--underline-width', `${link.offsetWidth - 2}px`);
                links.forEach(el => {
                    if (el !== link) el.style.color = '#b8b8b8';
                });
            }
        });

        link.addEventListener('mouseleave', () => {
            links.forEach(el => el.style.color = '#000000ff');
        });
    });

    updateValuesAndChart();


    document.getElementById('modeToggle1').addEventListener('click', () => switchMode(1));
    document.getElementById('modeToggle2').addEventListener('click', () => switchMode(2));

    const lensXSlider = document.getElementById('sliderLensX');
    if (lensXSlider) {
        lensXSlider.addEventListener('input', e => {
            if (currentMode === 1) {
                lensX1 = parseFloat(e.target.value);
            } else if (currentMode === 2) {
                lensX2 = parseFloat(e.target.value);
            }
            updateValuesAndChart();
        });
    }

    const focalRangeSlider = document.getElementById('sliderFocalRange');
    if (focalRangeSlider) {
        focalRangeSlider.addEventListener('input', e => {
            if (currentMode === 1) {
                focalRange1 = parseFloat(e.target.value);
            } else if (currentMode === 2) {
                focalRange2 = parseFloat(e.target.value);
            }
            updateValuesAndChart();
        });
    }


    const showLensBtn = document.getElementById('showLens');
    if (showLensBtn) {
        showLensBtn.addEventListener('click', () => {
            showCorrectionLens = !showCorrectionLens;
            warningVisible = false;
            updateValuesAndChart();

            const buttonLabel = document.querySelector(`label[for="showLens"]`);
            if (buttonLabel) {
                if (showCorrectionLens) {
                    buttonLabel.classList.add('active-mode');
                } else {
                    buttonLabel.classList.remove('active-mode');
                }
            }
        });
    }



    document.querySelectorAll('.modeTwoShow').forEach(el => {
        el.style.display = 'none';
    });
    

};
