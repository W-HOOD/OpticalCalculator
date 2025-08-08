// === Global Variables ===
let currentMode = 1;
let chart = null;


const baseDpr = window.devicePixelRatio || 1;
const dpr = baseDpr * 3;
const cssSize = 600;
const internalSize = cssSize * dpr;

// === Shared Constants ===
let firstValidThetaI = null;
let minThetaC = null;

let n = 0;
let f = 550;
let rayY = 50;
let alpha = 60;
let theta = 50;

let warningVisible = false;
let warningloopVisible = true;
let warningbottomVisible = false;

const FREQ_MIN = 405;
const FREQ_MAX = 790;

function normalizeFreq(freq) {
    return Math.min(Math.max(freq, FREQ_MIN), FREQ_MAX);
}

function switchMode(newMode) {
    if (newMode === currentMode) return;

    if (chart) {
        chart.destroy();
        chart = null;
    }

    const gridCanvas = document.getElementById('gridCanvas');
    const ctx = gridCanvas.getContext('2d');
    ctx.resetTransform();
    ctx.clearRect(0, 0, internalSize, internalSize);

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

    // Hide all mode elements
    document.querySelectorAll('.modeOneShow, .modeTwoShow, .modeThreeShow').forEach(el => {
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
            if (typeof loadTaskBGraph === 'function') loadTaskBGraph();
            break;
        case 3:
            document.querySelectorAll('.modeThreeShow').forEach(el => el.style.display = '');
            if (typeof loadTaskCGraph === 'function') loadTaskCGraph();
            break;
    }

    currentMode = newMode;
}



// === Helper: Frequency (THz) to Wavelength (nm) ===
function freqToWavelength(fTHz) {
    const c = 299792458;
    const fHz = fTHz * 1e12;
    const wavelengthM = c / fHz;
    return wavelengthM * 1e9;
}

function freqToRGB(fTHz) {
    const fMin = 405;
    const fMax = 790;

    const fClamped = Math.min(Math.max(fTHz, fMin), fMax);

    const wavelength = freqToWavelength(fClamped);

    const wlClamped = Math.min(Math.max(wavelength, 380), 750);

    const rgb = wavelengthToRGB(wlClamped);
    return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
}

function wavelengthToRGB(wavelength) {
    let R = 0, G = 0, B = 0, alpha = 1.0;

    if (wavelength >= 380 && wavelength < 440) {
        R = -(wavelength - 440) / (440 - 380);
        G = 0.0;
        B = 1.0;
    } else if (wavelength >= 440 && wavelength < 490) {
        R = 0.0;
        G = (wavelength - 440) / (490 - 440);
        B = 1.0;
    } else if (wavelength >= 490 && wavelength < 510) {
        R = 0.0;
        G = 1.0;
        B = -(wavelength - 510) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
        R = (wavelength - 510) / (580 - 510);
        G = 1.0;
        B = 0.0;
    } else if (wavelength >= 580 && wavelength < 645) {
        R = 1.0;
        G = -(wavelength - 645) / (645 - 580);
        B = 0.0;
    } else if (wavelength >= 645 && wavelength <= 750) {
        R = 1.0;
        G = 0.0;
        B = 0.0;
    }

    if (wavelength >= 380 && wavelength < 420) {
        alpha = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
    } else if (wavelength >= 420 && wavelength < 700) {
        alpha = 1.0;
    } else if (wavelength >= 700 && wavelength <= 750) {
        alpha = 0.3 + 0.7 * (750 - wavelength) / (750 - 700);
    } else {
        alpha = 0.0;
    }

    const gamma = 0.8;
    return {
        r: Math.round(Math.pow(R * alpha, gamma) * 255),
        g: Math.round(Math.pow(G * alpha, gamma) * 255),
        b: Math.round(Math.pow(B * alpha, gamma) * 255)
    };
}

// === Graph Utilities ===
function computeNFromF(f) {
    const f_scaled = (f * 1e12) / 1e15;
    const rhs = 1.731 - 0.261 * f_scaled * f_scaled;
    return Math.sqrt(1 + Math.pow(rhs, -0.5));
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

function updateValuesAndChart() {
    const fDisplay = document.getElementById('fValue');
    if (fDisplay) fDisplay.textContent = f.toFixed(2);

    const rayYDisplay = document.getElementById('rayYLabel');
    if (rayYDisplay) rayYDisplay.textContent = rayY.toFixed(1);

    const alpha1Display = document.getElementById('alpha1Value');
    if (alpha1Display) alpha1Display.textContent = alpha.toFixed(1);

    const thetaDisplay = document.getElementById('thetaValue');
    if (thetaDisplay) thetaDisplay.textContent = theta.toFixed(1);

    const alpha2Display = document.getElementById('alpha2Value');
    if (alpha2Display) alpha2Display.textContent = alpha.toFixed(1);

    switch (currentMode) {
        case 1: loadTaskACanvas(); break;
        case 2: loadTaskBGraph(); break;
        case 3: loadTaskCGraph(); break;
    }
}



function crownGlassRefractiveIndex(lambda_nm) {
    const x = lambda_nm / 1000;

    // Sellmeier coefficients
    const a = [1.03961212, 0.231792344, 1.01146945];
    const b = [0.00600069867, 0.0200179144, 103.560653];

    let y = 0;
    for (let i = 0; i < a.length; i++) {
        y += (a[i] * x * x) / (x * x - b[i]);
    }

    return Math.sqrt(1 + y);
}

const wavelengths = [
    { lambda: 700, color: '#ff0000' },
    { lambda: 620, color: '#ff7f00' },
    { lambda: 580, color: '#ffff00' },
    { lambda: 530, color: '#00ff00' },
    { lambda: 470, color: '#0000ff' },
    { lambda: 430, color: '#4b0082' },
    { lambda: 400, color: '#8b00ff' }
];

function lineIntersection(A, B, C, D) {
    const a1 = B.y - A.y;
    const b1 = A.x - B.x;
    const c1 = a1 * A.x + b1 * A.y;

    const a2 = D.y - C.y;
    const b2 = C.x - D.x;
    const c2 = a2 * C.x + b2 * C.y;

    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-8) return null;

    const x = (b2 * c1 - b1 * c2) / det;
    const y = (a1 * c2 - a2 * c1) / det;

    const onSegment = (px, py, A, B) => {
        const buffer = 1e-6;
        return (
            px >= Math.min(A.x, B.x) - buffer &&
            px <= Math.max(A.x, B.x) + buffer &&
            py >= Math.min(A.y, B.y) - buffer &&
            py <= Math.max(A.y, B.y) + buffer
        );
    };

    if (onSegment(x, y, A, B) && onSegment(x, y, C, D)) {
        return { x, y };
    }

    return null;
}



const drawVerticalLinePlugin = {
    id: 'drawVerticalLinePlugin',
    afterDatasetsDraw(chart) {
        if (firstValidThetaI === null) return;

        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const x = xScale.getPixelForValue(firstValidThetaI);

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([5, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#3e47f0';
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
        ctx.restore();
    }
};


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



    // Triangle setup
    const height = 200;
    const angleRad = alpha * Math.PI / 180;
    const halfBase = height * Math.tan(angleRad / 2);
    const yShift = height / 3;

    const p1 = { x: 0, y: -height + yShift };
    const p2 = { x: -halfBase, y: yShift };
    const p3 = { x: halfBase, y: yShift };

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Contact point on left edge
    const t = 1 - (rayY / 100);
    const contactX = p1.x + t * (p2.x - p1.x);
    const contactY = p1.y + t * (p2.y - p1.y);

    // Normal of left triangle edge
    const normalAngle = 180 - alpha / 2;

    const rayAngleFromHorizontal = normalAngle + theta;
    const thetaRad = rayAngleFromHorizontal * Math.PI / 180;

    const rayDirX = Math.cos(thetaRad);
    const rayDirY = -Math.sin(thetaRad);


    const rayEndX = contactX;
    const rayEndY = contactY;

    const rayStartX = contactX + 1000 * rayDirX;
    const rayStartY = contactY + 1000 * rayDirY;


    ctx.beginPath();
    ctx.moveTo(rayStartX, rayStartY);
    ctx.lineTo(rayEndX, rayEndY);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.stroke();

    warningloopVisible = true
    warningbottomVisible = false
    const n1 = 1;

    wavelengths.forEach(({ lambda, color }) => {
        const n2 = crownGlassRefractiveIndex(lambda);

        // Incident angle relative to normal
        const theta1Rad = theta * Math.PI / 180;

        const sinTheta2 = (n1 / n2) * Math.sin(theta1Rad);

        // Total internal reflection not possible here since n2 > n1
        if (Math.abs(sinTheta2) > 1) return;

        const theta2Rad = Math.asin(sinTheta2);

        // Refracted ray angle
        const refractedAngle = normalAngle + (theta2Rad * 180 / Math.PI);
        const refractedRad = refractedAngle * Math.PI / 180;

        const refractedDirX = -Math.cos(refractedRad);
        const refractedDirY = Math.sin(refractedRad);

        const farX = contactX + 1000 * refractedDirX;
        const farY = contactY + 1000 * refractedDirY;

        // Try intersecting with remaining two triangle edges
        const inter2 = lineIntersection(
            { x: contactX, y: contactY },
            { x: farX, y: farY },
            p2, p3
        );
        const inter3 = lineIntersection(
            { x: contactX, y: contactY },
            { x: farX, y: farY },
            p3, p1
        );

        let exitPoint = inter2 || inter3;
        if (!exitPoint) return;

        const warningctx = warningOverlay.getContext("2d");
        // Check if exit point is on bottom edge (p2-p3)
        if (exitPoint === inter2 && exitPoint !== null) {
            warningbottomVisible = true;
        }


        // Draw refracted ray
        ctx.beginPath();
        ctx.moveTo(contactX, contactY);
        ctx.lineTo(exitPoint.x, exitPoint.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Normal of exit edge
        let exitNormalAngle;
        if (exitPoint === inter2) {
            // Edge from p2 to p3 (bottom)
            const edgeAngle = Math.atan2(p3.y - p2.y, p3.x - p2.x) * 180 / Math.PI;
            exitNormalAngle = edgeAngle - 90;
        } else {
            // Edge from p3 to p1 (right)
            const edgeAngle = Math.atan2(p1.y - p3.y, p1.x - p3.x) * 180 / Math.PI;
            exitNormalAngle = edgeAngle - 90;
        }

        // Incident angle inside prism
        const internalAngleRad = Math.atan2(
            exitPoint.y - contactY,
            exitPoint.x - contactX
        );
        const internalAngleFromHorizontal = internalAngleRad * 180 / Math.PI;
        const incidentExitAngle = internalAngleFromHorizontal - exitNormalAngle;
        

        const incidentExitRad = incidentExitAngle * Math.PI / 180;
        const sinTheta3 = (n2 / n1) * Math.sin(incidentExitRad);

        // Handle total internal reflection
        if (Math.abs(sinTheta3) > 1) {
            return;
        }

        const theta3Rad = Math.asin(sinTheta3);
        const exitAngle = exitNormalAngle + 180 - (theta3Rad * 180 / Math.PI);
        const exitRad = exitAngle * Math.PI / 180;

        console.log(incidentExitAngle);


        if (incidentExitAngle < 220.5) {
            warningloopVisible = false;
        }

        // Final ray direction
        const exitDirX = Math.cos(exitRad);
        const exitDirY = Math.sin(exitRad);

        const exitRayEndX = exitPoint.x + 1000 * exitDirX;
        const exitRayEndY = exitPoint.y + 1000 * exitDirY;



        // Draw exit ray
        ctx.beginPath();
        ctx.moveTo(exitPoint.x, exitPoint.y);
        ctx.lineTo(exitRayEndX, exitRayEndY);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();


    });

    const warningctx = warningOverlay.getContext("2d");

    if (warningbottomVisible) {

        // Show warning overlay
        warningOverlay.width = internalSize;
        warningOverlay.height = internalSize;
        warningctx.scale(dpr, dpr);

        warningctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        warningctx.fillRect(0, 0, cssSize, cssSize);

        warningctx.font = "700 24px Montserrat, sans-serif";
        warningctx.fillStyle = "white";
        warningctx.textAlign = "center";
        warningctx.textBaseline = "middle";

        warningctx.fillText("⚠️ RAY HITS BOTTOM EDGE", cssSize / 2, (cssSize / 2) - 16);
        warningctx.font = "500 14px Montserrat, sans-serif";
        warningctx.fillText("ADJUST SLIDERS TO MOVE RAY AWAY FROM BOTTOM EDGE", cssSize / 2, (cssSize / 2) + 16);

        warningVisible = true;
        warningOverlay.style.opacity = 1;
    } else if (warningloopVisible) {

        warningOverlay.width = internalSize;
        warningOverlay.height = internalSize;
        warningctx.scale(dpr, dpr);
        console.log("success")

        warningctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        warningctx.fillRect(0, 0, cssSize, cssSize);

        warningctx.font = "700 24px Montserrat, sans-serif";
        warningctx.fillStyle = "white";
        warningctx.textAlign = "center";
        warningctx.textBaseline = "middle";

        warningctx.fillText("⚠️ CRITICAL ANGLE APPROACHED", cssSize / 2, (cssSize / 2) - 16);
        warningctx.font = "500 14px Montserrat, sans-serif";
        warningctx.fillText("ADJUST SLIDERS TO INCREASE ANGLE OF INCIDENCE", cssSize / 2, (cssSize / 2) + 16);

        warningVisible = true;
        warningOverlay.style.opacity = 1;
    } else {
        warningVisible = false;
        warningOverlay.style.opacity = 0;
    };


    // Reset transform
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    drawGrid(ctx, cssSize, cssSize, 50);


    
}

function loadTaskBGraph() {
    warningVisible = false;
    warningOverlay.style.opacity = 0;
    const lambdaNm = freqToWavelength(f);
    const n = crownGlassRefractiveIndex(lambdaNm);
    const alphaRad = alpha * Math.PI / 180;

    const data = [];
    firstValidThetaI = null;


    let roughMin = null;
    for (let theta_i = 0; theta_i <= 90; theta_i += 1) {
        const theta_i_rad = theta_i * Math.PI / 180;
        const sin_term = Math.sqrt(Math.max(0, n * n - Math.pow(Math.sin(theta_i_rad), 2))) * Math.sin(alphaRad)
                        - Math.sin(theta_i_rad) * Math.cos(alphaRad);

        if (sin_term >= -1 && sin_term <= 1) {
            roughMin = Math.max(0, theta_i - 1);
            break;
        }
    }


    if (roughMin !== null) {
        for (let theta_i = roughMin; theta_i <= 90; theta_i += 0.01) {
            const theta_i_rad = theta_i * Math.PI / 180;
            const sin_term = Math.sqrt(Math.max(0, n * n - Math.pow(Math.sin(theta_i_rad), 2))) * Math.sin(alphaRad)
                            - Math.sin(theta_i_rad) * Math.cos(alphaRad);

            if (sin_term >= -1 && sin_term <= 1) {
                const theta_t_rad = Math.asin(sin_term);
                const theta_t_deg = theta_t_rad * 180 / Math.PI;

                data.push({ x: theta_i, y: theta_t_deg });

                if (firstValidThetaI === null) {
                    firstValidThetaI = theta_i;
                }
            }
        }
    }


    const clampedF = normalizeFreq(f);
    const primaryColor = freqToRGB(clampedF);

    const dataset = {
        label: 'Crown Glass',
        data: data,
        backgroundColor: primaryColor,
        borderColor: primaryColor,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        order: 1
    };

    const minThetaLegend = {
        label: `θₘᵢₙ = ${firstValidThetaI?.toFixed(2)}°`,
        data: [],
        borderColor: '#3e47f0',
        backgroundColor: 'transparent',
        borderDash: [5, 3],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        order: 2
    };

    if (!chart) {
        const ctx = document.getElementById('chart-task-12').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [dataset, minThetaLegend] },
            options: {
                color: '000000',
                responsive: true,
                aspectRatio: 1,
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'θᵢ / °' },
                        min: 0, max: 90
                    },
                    y: {
                        title: { display: true, text: 'θₜ / °' },
                        min: 0, max: 90
                    }
                },
                plugins: {
                    legend: {
                        color: '000000',
                        labels: {
                            font: {
                                family: 'Montserrat',
                                padding: 20
                            }
                        }
                    },
                    title: {
                        color: '000000',
                        display: true,
                        text: 'TRANSMISSION ANGLE VS INCIDENT ANGLE',
                        font: { family: 'Montserrat', size: 18, weight: 'bold' }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `θᵢ = ${ctx.parsed.x.toFixed(2)}°, θₜ = ${ctx.parsed.y.toFixed(2)}°`,
                            title: () => null
                        }
                    }
                }
            },
            plugins: [drawVerticalLinePlugin]
        });
    } else {
        chart.data.datasets[0].data = data;
        chart.data.datasets[0].backgroundColor = primaryColor;
        chart.data.datasets[0].borderColor = primaryColor;

        chart.data.datasets[1].label = `θₘᵢₙ = ${firstValidThetaI?.toFixed(2)}°`;

        chart.update();
    }
}

function loadTaskCGraph() {
    warningVisible = false;
    warningOverlay.style.opacity = 0;
    const lambdaNm = freqToWavelength(f);
    const n = crownGlassRefractiveIndex(lambdaNm);
    const alphaRad = alpha * Math.PI / 180;

    const data = [];
    for (let theta_i = 0; theta_i <= 90; theta_i += 0.5) {
        const theta_i_rad = theta_i * Math.PI / 180;
        const sin_term = Math.sqrt(Math.max(0, n * n - Math.pow(Math.sin(theta_i_rad), 2))) * Math.sin(alphaRad)
                         - Math.sin(theta_i_rad) * Math.cos(alphaRad);

        if (sin_term >= -1 && sin_term <= 1) {
            const theta_t_rad = Math.asin(sin_term);
            const theta_t_deg = theta_t_rad * 180 / Math.PI;

            const delta = theta_i + theta_t_deg - alpha;
            data.push({ x: theta_i, y: delta });
        }
    }

    const firstValidPoint = data.find(p => p.y !== undefined);
    let roughMin = firstValidPoint ? firstValidPoint.x : 0;

    roughMin = Math.max(0, roughMin - 1);
    minThetaC = roughMin;
    for (let theta_i = roughMin; theta_i <= 90; theta_i += 0.01) {
        const theta_i_rad = theta_i * Math.PI / 180;
        const sin_term = Math.sqrt(Math.max(0, n * n - Math.pow(Math.sin(theta_i_rad), 2))) * Math.sin(alphaRad)
                         - Math.sin(theta_i_rad) * Math.cos(alphaRad);

        if (sin_term >= -1 && sin_term <= 1) {
            minThetaC = theta_i;
            break;
        }
    }

    const clampedF = normalizeFreq(f);
    const primaryColor = freqToRGB(clampedF);

    const dataset = {
        label: 'Crown Glass',
        data: data,
        backgroundColor: primaryColor,
        borderColor: primaryColor,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        order: 1
    };

    const dashedLineLegend = {
        label: `θₘᵢₙ = ${minThetaC.toFixed(2)}°`,
        borderColor: '#3e47f0',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [5, 3],
        pointRadius: 0,
        fill: false,
        data: [],
        order: 2
    };

    if (!chart) {
        const ctx = document.getElementById('chart-task-12').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [dataset, dashedLineLegend] },
            options: {
                color: '000000',
                responsive: true,
                aspectRatio: 1,
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'θᵢ / °' },
                        min: 0, max: 90
                    },
                    y: {
                        title: { display: true, text: 'δ / °' },
                        min: 0, max: 90
                    }
                },
                plugins: {
                    legend: {
                        color: '000000',
                        labels: {
                            font: {
                                family: 'Montserrat',
                                padding: 20
                            }
                        }
                    },
                    title: {
                        color: '000000',
                        display: true,
                        text: 'DEFLECTION ANGLE VS INCIDENT ANGLE',
                        font: { family: 'Montserrat', size: 18, weight: 'bold' }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `θᵢ = ${ctx.parsed.x.toFixed(2)}°, δ = ${ctx.parsed.y.toFixed(2)}°`,
                            title: () => null
                        }
                    }
                }
            },
            plugins: [{
                id: 'minThetaLine',
                afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    const xScale = chart.scales.x;
                    const yScale = chart.scales.y;

                    const x = xScale.getPixelForValue(minThetaC);

                    ctx.save();
                    ctx.strokeStyle = '#3e47f0';
                    ctx.setLineDash([5, 3]);
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x, yScale.top);
                    ctx.lineTo(x, yScale.bottom);
                    ctx.stroke();
                    ctx.restore();
                }
            }]
        });
    } else {
        chart.data.datasets[0].data = data;
        chart.data.datasets[0].backgroundColor = primaryColor;
        chart.data.datasets[0].borderColor = primaryColor;

        chart.options.plugins.title.text = 'DEFLECTION ANGLE VS INCIDENT ANGLE';

        chart.data.datasets[1].label = `θₘᵢₙ = ${minThetaC.toFixed(2)}°`;
        chart.update();

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
    document.getElementById('modeToggle3').addEventListener('click', () => switchMode(3));

    const freqSlider = document.getElementById('sliderF');
    if (freqSlider) {
        freqSlider.addEventListener('input', e => {
            f = parseFloat(e.target.value);
            updateValuesAndChart();
        });
    }

    const rayYSlider = document.getElementById('sliderRayY');
    if (rayYSlider) {
        rayYSlider.addEventListener('input', e => {
            rayY = parseFloat(e.target.value);
            updateValuesAndChart();
        });
    }

    const alpha1Slider = document.getElementById('sliderAlpha1');
    if (alpha1Slider) {
        alpha1Slider.addEventListener('input', e => {
            alpha = parseFloat(e.target.value);
            updateValuesAndChart();
        });
    }

    const thetaSlider = document.getElementById('sliderTheta');
    if (thetaSlider) {
        thetaSlider.addEventListener('input', e => {
            theta = parseFloat(e.target.value);
            updateValuesAndChart();
        });
    }

    const alpha2Slider = document.getElementById('sliderAlpha2');
    if (alpha2Slider) {
        alpha2Slider.addEventListener('input', e => {
            alpha = parseFloat(e.target.value);
            updateValuesAndChart();
        });
    }

    const fSlider = document.getElementById('sliderF');
    if (fSlider) {
        fSlider.addEventListener('input', e => {
            f = parseFloat(e.target.value);
            updateValuesAndChart();
        });
    }

    document.querySelectorAll('.modeTwoShow, .modeThreeShow').forEach(el => {
        el.style.display = 'none';
    });
    
};
