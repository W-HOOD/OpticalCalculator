// === Global Variables ===
let currentMode = 1;
let chart = null;

// === Shared Constants ===
let f = 550;
let theta = 0;
let epsilon = 0;
let n = 0;

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

    // Remove active-mode from all labels (not buttons)
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
    document.querySelectorAll('.modeOneShow, .modeTwoShow, .modeThreeShow, .modeFourShow').forEach(el => {
        el.style.display = 'none';
    });

    // Show elements and load graphs
    switch (newMode) {
        case 1:
            document.querySelectorAll('.modeOneShow').forEach(el => el.style.display = '');
            loadTaskAGraph();
            break;
        case 2:
            document.querySelectorAll('.modeTwoShow').forEach(el => el.style.display = '');
            if (typeof loadTaskBGraph === 'function') loadTaskBGraph();
            break;
        case 3:
            document.querySelectorAll('.modeThreeShow').forEach(el => el.style.display = '');
            if (typeof loadTaskCGraph === 'function') loadTaskCGraph();
            break;
        case 4:
            document.querySelectorAll('.modeFourShow').forEach(el => el.style.display = '');
            if (typeof loadTaskDGraph === 'function') loadTaskDGraph();
            break;
    }

    currentMode = newMode;
}



// === Helper: Frequency (THz) to Wavelength (nm) ===
function freqToWavelength(fTHz) {
    const c = 3e8;               // speed of light (m/s)
    const fHz = fTHz * 1e12;     // frequency in Hz
    const wavelengthM = c / fHz; // wavelength in meters
    return wavelengthM * 1e9;    // wavelength in nanometers
}

function freqToRGB(fTHz) {
    const fMin = 405;
    const fMax = 790;

    // Clamp frequency within bounds
    const fClamped = Math.min(Math.max(fTHz, fMin), fMax);

    // Convert to wavelength (nm)
    const wavelength = freqToWavelength(fClamped);

    // Clamp wavelength visible range: 380-750 nm
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

function createSpectralGradient(ctx, width, fMin = 405, fMax = 790) {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
        const freq = fMin + (fMax - fMin) * (i / steps);
        gradient.addColorStop(i / steps, freqToRGB(freq));
    }
    return gradient;
}


// === Graph Utilities ===
function computeNFromF(f) {
    const f_scaled = (f * 1e12) / 1e15;
    const rhs = 1.731 - 0.261 * f_scaled * f_scaled;
    return Math.sqrt(1 + Math.pow(rhs, -0.5));
}

// Global function to create spectral gradient and sample colors by frequency

function getGradientColorAtFreq(ctx, gradient, f, fMin, fMax, canvasWidth) {
    const ratio = (f - fMin) / (fMax - fMin);
    const xPixel = Math.round(ratio * canvasWidth);

    if (!getGradientColorAtFreq.offscreenCanvas) {
        getGradientColorAtFreq.offscreenCanvas = document.createElement('canvas');
        getGradientColorAtFreq.offscreenCanvas.width = canvasWidth;
        getGradientColorAtFreq.offscreenCanvas.height = 1;
        const offCtx = getGradientColorAtFreq.offscreenCanvas.getContext('2d');
        offCtx.fillStyle = gradient;
        offCtx.fillRect(0, 0, canvasWidth, 1);
    }
    const offCtx = getGradientColorAtFreq.offscreenCanvas.getContext('2d');
    const pixel = offCtx.getImageData(xPixel, 0, 1, 1).data;
    return `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
}

function generateEpsilonThetaData(n, type) {
    const data = [];
    for (let thetaDeg = 0.1; thetaDeg <= 90; thetaDeg += 0.5) {
        const thetaRad = thetaDeg * Math.PI / 180;
        const ratio = Math.sin(thetaRad) / n;

        if (Math.abs(ratio) > 1) continue;

        const alpha = Math.asin(ratio);
        let epsilonRad = type === 'first'
            ? Math.PI - 6 * alpha + 2 * thetaRad
            : 4 * alpha - 2 * thetaRad;

        data.push({ x: thetaDeg, y: epsilonRad * 180 / Math.PI });
    }
    return data;
}

function findMinPoint(data) {
    return data.reduce((minPt, pt) => (pt.y < minPt.y ? pt : minPt), data[0]);
}

function findMaxPoint(data) {
    return data.reduce((maxPt, pt) => (pt.y > maxPt.y ? pt : maxPt), data[0]);
}

function updateValuesAndChart() {
    const fDisplay = document.getElementById('fValue');
    if (fDisplay) fDisplay.textContent = f.toFixed(2);

    switch (currentMode) {
        case 1: loadTaskAGraph(); break;
        case 2: loadTaskBGraph(); break;
        case 3: loadTaskCGraph(); break;
        case 4: loadTaskDGraph?.(); break;
    }
}

// === Fade Control ===
const fadeDuration = 500;
const dashedLineOpacities = {
    minFirst: 1,
    maxSecond: 1
};
const targetOpacities = {
    minFirst: 1,
    maxSecond: 1
};
const lastTimestamps = {};

// === Plugins ===
const highlightSpecialPointsPlugin = {
    id: 'highlightSpecialPoints',
    afterDraw(chart) {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        chart.data.datasets.forEach(dataset => {
            if (!dataset.isSpecialPoint || !dataset.data.length) return;

            const point = dataset.data[0];
            const px = xScale.getPixelForValue(point.x);
            const py = yScale.getPixelForValue(point.y);
            const opacity = dashedLineOpacities[dataset.specialType] || 0;

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.strokeStyle = freqToRGB(f);
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(xScale.left, py);
            ctx.lineTo(px, py);
            ctx.stroke();
            ctx.restore();
        });
    }
};

const drawSpecialPointsOverlayPlugin = {
    id: 'drawSpecialPointsOverlay',
    afterDraw(chart) {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        chart.data.datasets.forEach(dataset => {
            if (!dataset.isSpecialPoint || !dataset.data.length) return;

            const opacity = dashedLineOpacities[dataset.specialType] || 0;
            if (opacity <= 0) return;

            const point = dataset.data[0];
            const px = xScale.getPixelForValue(point.x);
            const py = yScale.getPixelForValue(point.y);

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.strokeStyle = dataset.borderColor || 'black';
            ctx.lineWidth = 1.5;

            const size = 6;
            ctx.beginPath();
            ctx.moveTo(px - size, py);
            ctx.lineTo(px + size, py);
            ctx.moveTo(px, py - size);
            ctx.lineTo(px, py + size);
            ctx.stroke();
            ctx.restore();
        });
    }
};

function animateFade(chart, type, timestamp) {
    if (!lastTimestamps[type]) lastTimestamps[type] = timestamp;
    const dt = timestamp - lastTimestamps[type];
    lastTimestamps[type] = timestamp;

    const delta = dt / fadeDuration;
    const current = dashedLineOpacities[type];
    const target = targetOpacities[type];

    if (current < target)
        dashedLineOpacities[type] = Math.min(current + delta, target);
    else
        dashedLineOpacities[type] = Math.max(current - delta, target);

    chart.draw();

    if (Math.abs(dashedLineOpacities[type] - target) > 0.01)
        requestAnimationFrame(ts => animateFade(chart, type, ts));
    else
        lastTimestamps[type] = null;
}

// === Chart Loader ===
function loadTaskAGraph() {
    n = computeNFromF(f);

    const data1 = generateEpsilonThetaData(n, 'first');
    const data2 = generateEpsilonThetaData(n, 'second');

    const minPointFirst = findMinPoint(data1);
    const maxPointSecond = findMaxPoint(data2);

    // Clamp slider frequency to common range
    const clampedF = normalizeFreq(f);
    const primaryColor = freqToRGB(clampedF);

    const specialPoints = [
        {
            label: `θ = ${minPointFirst.x.toFixed(2)}°, ε = ${minPointFirst.y.toFixed(2)}°`,
            data: [minPointFirst],
            backgroundColor: 'rgba(255, 0, 0,0)',
            borderColor: 'rgb(255, 0, 0)',
            pointRadius: 0,
            isSpecialPoint: true,
            specialType: 'minFirst',
            order: 4
        },
        {
            label: `θ = ${maxPointSecond.x.toFixed(2)}°, ε = ${maxPointSecond.y.toFixed(2)}°`,
            data: [maxPointSecond],
            backgroundColor: 'rgba(0, 0, 255,0)',
            borderColor: 'rgb(0, 0, 255)',
            pointRadius: 0,
            isSpecialPoint: true,
            specialType: 'maxSecond',
            order: 3
        }
    ];

    if (!chart) {
        const ctx = document.getElementById('chart-task-11').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Secondary Rainbow',
                        data: data1,
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 1,
                        order: 2
                    },
                    {
                        label: 'Primary Rainbow',
                        data: data2,
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 1,
                        order: 1
                    },
                    ...specialPoints
                ]
            },
            options: {
                responsive: true,
                aspectRatio: 1,
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'θ / °' },
                        min: 0, max: 90
                    },
                    y: {
                        title: { display: true, text: 'ε / °' },
                        min: 0, max: 180,
                        ticks: {
                            callback: value => Number.parseFloat(value).toPrecision(3)
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: { 
                            font: { 
                                family: 'Montserrat',
                                padding: 20
                            } 
                        },
                        onClick: function(e, legendItem, legend) {
                            const index = legendItem.datasetIndex;
                            const chart = legend.chart;
                            const dataset = chart.data.datasets[index];
                            dataset.hidden = !dataset.hidden;
                            if (dataset.isSpecialPoint) {
                                const type = dataset.specialType;
                                targetOpacities[type] = dataset.hidden ? 0 : 1;
                                if (!lastTimestamps[type]) {
                                    requestAnimationFrame(ts => animateFade(chart, type, ts));
                                }
                            }
                            chart.update();
                        }
                    },
                    title: {
                        display: true,
                        text: 'ELEVATION OF DEFLECTED BEAM',
                        font: { family: 'Montserrat', size: 18, weight: 'bold' }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `θ = ${ctx.parsed.x.toFixed(2)}°, ε = ${ctx.parsed.y.toFixed(2)}°`,
                            title: () => null
                        }
                    }
                }
            },
            plugins: [highlightSpecialPointsPlugin, drawSpecialPointsOverlayPlugin]
        });
    } else {
        chart.data.datasets[0].data = data1;
        chart.data.datasets[1].data = data2;
        chart.data.datasets[2].data = [minPointFirst];
        chart.data.datasets[3].data = [maxPointSecond];
        chart.data.datasets[2].label = `θ = ${minPointFirst.x.toFixed(2)}°, ε = ${minPointFirst.y.toFixed(2)}°`;
        chart.data.datasets[3].label = `θ = ${maxPointSecond.x.toFixed(2)}°, ε = ${maxPointSecond.y.toFixed(2)}°`;

        chart.data.datasets[0].backgroundColor = primaryColor;
        chart.data.datasets[0].borderColor = primaryColor;

        chart.data.datasets[1].backgroundColor = primaryColor;
        chart.data.datasets[1].borderColor = primaryColor;

        chart.update();
    }

    targetOpacities.minFirst = 1;
    targetOpacities.maxSecond = 1;
    requestAnimationFrame(ts => animateFade(chart, 'minFirst', ts));
    requestAnimationFrame(ts => animateFade(chart, 'maxSecond', ts));
}

function loadTaskBGraph() {
    const fMin = 405;
    const fMax = 790;
    const step = 5;

    const data1 = [];
    const data2 = [];

    const datasetOpacities = {
        rainbowPrimary: 1,
        rainbowSecondary: 1
    };
    const targetDatasetOpacities = {
        rainbowPrimary: 1,
        rainbowSecondary: 1
    };
    const lastTimestamps = {};
    const fadeDuration = 500;

    for (let f = fMin; f <= fMax; f += step) {
        const n = computeNFromF(f);

        const arg1 = (9 - n * n) / 8;
        if (arg1 >= 0 && arg1 <= 1) {
            const theta1 = Math.asin(Math.sqrt(arg1));
            const eps1 = Math.PI - 6 * Math.asin(Math.sin(theta1) / n) + 2 * theta1;
            data1.push({ x: f, y: (eps1 * 180) / Math.PI });
        }

        const arg2 = (4 - n * n) / 3;
        if (arg2 >= 0 && arg2 <= 1) {
            const theta2 = Math.asin(Math.sqrt(arg2));
            const eps2 = 4 * Math.asin(Math.sin(theta2) / n) - 2 * theta2;
            data2.push({ x: f, y: (eps2 * 180) / Math.PI });
        }
    }

    function animateDatasetFade(type, timestamp) {
        if (!lastTimestamps[type]) lastTimestamps[type] = timestamp;
        const dt = timestamp - lastTimestamps[type];
        lastTimestamps[type] = timestamp;

        const delta = dt / fadeDuration;
        const current = datasetOpacities[type];
        const target = targetDatasetOpacities[type];

        datasetOpacities[type] = current < target
            ? Math.min(current + delta, target)
            : Math.max(current - delta, target);

        chart.update('none');

        if (Math.abs(datasetOpacities[type] - target) > 0.01) {
            requestAnimationFrame(ts => animateDatasetFade(type, ts));
        } else {
            lastTimestamps[type] = null;
        }
    }

    const datasetFadePlugin = {
    id: 'datasetFadePlugin',
    beforeDatasetDraw(chart, args) {
        const ctx = chart.ctx;
        const id = chart.data.datasets[args.index].id;
        if (id && datasetOpacities[id] !== undefined) {
        const alpha = datasetOpacities[id];
        if (alpha < 0.01) {
            // Skip drawing if fully transparent
            args.cancel = true;
            return;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        }
    },
    afterDatasetDraw(chart, args) {
        const ctx = chart.ctx;
        const id = chart.data.datasets[args.index].id;
        if (id && datasetOpacities[id] !== undefined && datasetOpacities[id] >= 0.01) {
        ctx.restore();
        }
    }
    };


    function createSpectralGradient(ctx, chart) {
        const xStart = chart.scales.x.getPixelForValue(fMin);
        const xEnd = chart.scales.x.getPixelForValue(fMax);
        const gradient = ctx.createLinearGradient(xStart, 0, xEnd, 0);
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
            const freq = fMin + (fMax - fMin) * (i / steps);
            gradient.addColorStop(i / steps, freqToRGB(freq));
        }
        return gradient;
    }

    const ctx = document.getElementById('chart-task-11').getContext('2d');

    const applyGradientPlugin = {
        id: 'applyGradientPlugin',
        afterLayout(chartInstance, args, options) {
            if (!chartInstance._gradientApplied) {
                const gradient = createSpectralGradient(chartInstance.ctx, chartInstance);
                chartInstance.data.datasets.forEach(ds => ds.borderColor = gradient);
                chartInstance._gradientApplied = true; // prevent infinite loop
                chartInstance.update(); // one-time update
            }
        }
    };


    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    id: 'rainbowSecondary',
                    label: 'Secondary Rainbow',
                    data: data1,
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.4,
                    order: 2
                },
                {
                    id: 'rainbowPrimary',
                    label: 'Primary Rainbow',
                    data: data2,
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.4,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            aspectRatio: 1,
            scales: {
                x: {
                    type: 'linear',
                    min: 400,
                    max: 800,
                    title: {
                        display: true,
                        text: 'f / THz'
                    }
                },
                y: {
                    min: 40,
                    max: 54,
                    title: {
                        display: true,
                        text: 'ε / °'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        font: {
                            family: 'Montserrat',
                            padding: 20
                        }
                    },
                    onClick: function (e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const dataset = legend.chart.data.datasets[index];
                        const id = dataset.id;

                        const meta = legend.chart.getDatasetMeta(index);
                        meta.hidden = !meta.hidden;

                        if (id && targetDatasetOpacities[id] !== undefined) {
                            targetDatasetOpacities[id] = meta.hidden ? 0 : 1;
                            if (!lastTimestamps[id]) {
                                requestAnimationFrame(ts => animateDatasetFade(id, ts));
                            }
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'ELEVATION OF SINGLE AND DOUBLE RAINBOWS',
                    font: {
                        family: 'Montserrat',
                        size: 18,
                        weight: 'bold'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `f = ${ctx.parsed.x.toFixed(1)} THz, ε = ${ctx.parsed.y.toFixed(2)}°`,
                        title: () => null
                    }
                }
            }
        },
        plugins: [datasetFadePlugin, applyGradientPlugin]
    });
}



function loadTaskCGraph() {
    const fMin = 405;
    const fMax = 790;
    const step = 5;

    const dataCritical = [];
    const dataCurve1 = [];
    const dataCurve2 = [];

    for (let fVal = fMin; fVal <= fMax; fVal += step) {
        const n = computeNFromF(fVal);

        const criticalAngle = Math.asin(1 / n); // radians
        dataCritical.push({ x: fVal, y: (criticalAngle * 180) / Math.PI });

        const arg1 = (9 - n * n) / 8;
        if (arg1 >= 0 && arg1 <= 1) {
            const theta1 = Math.asin(Math.sqrt(arg1));
            const phi1 = Math.asin(Math.sin(theta1) / n);
            dataCurve1.push({ x: fVal, y: (phi1 * 180) / Math.PI });
        }

        const arg2 = (4 - n * n) / 3;
        if (arg2 >= 0 && arg2 <= 1) {
            const theta2 = Math.asin(Math.sqrt(arg2));
            const phi2 = Math.asin(Math.sin(theta2) / n);
            dataCurve2.push({ x: fVal, y: (phi2 * 180) / Math.PI });
        }
    }

    // === Opacity control for fade animation ===
    const datasetOpacities = {
        critical: 1,
        primary: 1,
        secondary: 1
    };
    const targetDatasetOpacities = {
        critical: 1,
        primary: 1,
        secondary: 1
    };
    const lastTimestamps = {};
    const fadeDuration = 500;

    function animateDatasetFade(type, timestamp) {
        if (!lastTimestamps[type]) lastTimestamps[type] = timestamp;
        const dt = timestamp - lastTimestamps[type];
        lastTimestamps[type] = timestamp;

        const delta = dt / fadeDuration;
        const current = datasetOpacities[type];
        const target = targetDatasetOpacities[type];

        datasetOpacities[type] = current < target
            ? Math.min(current + delta, target)
            : Math.max(current - delta, target);

        chart.draw();

        if (Math.abs(datasetOpacities[type] - target) > 0.01) {
            requestAnimationFrame(ts => animateDatasetFade(type, ts));
        } else {
            lastTimestamps[type] = null;
        }
    }

    const datasetFadePlugin = {
        id: 'datasetFadePlugin',
        beforeDatasetDraw(chart, args) {
            const ctx = chart.ctx;
            const id = chart.data.datasets[args.index].id;
            if (id && datasetOpacities[id] !== undefined) {
                ctx.save();
                ctx.globalAlpha = datasetOpacities[id];
            }
        },
        afterDatasetDraw(chart, args) {
            const ctx = chart.ctx;
            const id = chart.data.datasets[args.index].id;
            if (id && datasetOpacities[id] !== undefined) {
                ctx.restore();
            }
        }
    };

    // Create spectral gradient across the x-axis range
    function createSpectralGradient(ctx, chartInstance) {
        const fMin = 405;
        const fMax = 790;
        const xStart = chartInstance.scales.x.getPixelForValue(fMin);
        const xEnd = chartInstance.scales.x.getPixelForValue(fMax);
        const gradient = ctx.createLinearGradient(xStart, 0, xEnd, 0);
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
            const freq = fMin + (fMax - fMin) * (i / steps);
            gradient.addColorStop(i / steps, freqToRGB(freq));
        }
        return gradient;
    }

    const ctx = document.getElementById('chart-task-11').getContext('2d');

    // Plugin to apply the gradient border color once chart scales are ready
    const applyGradientPlugin = {
        id: 'applyGradientPlugin',
        afterLayout(chartInstance) {
            if (!chartInstance._gradientApplied) {
                const gradient = createSpectralGradient(ctx, chartInstance);
                // Apply gradient only to primary and secondary rainbow datasets
                chartInstance.data.datasets.forEach(ds => {
                    if (ds.id === 'primary' || ds.id === 'secondary') {
                        ds.borderColor = gradient;
                    }
                });
                chartInstance._gradientApplied = true;
                chartInstance.update();
            }
        }
    };

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Critical angle',
                    data: dataCritical,
                    borderColor: 'black',
                    backgroundColor: 'black',
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0,
                    order: 0,
                    id: 'critical'
                },
                {
                    id: 'primary',
                    label: 'Primary Rainbow',
                    data: dataCurve1,
                    borderColor: 'transparent', // will be replaced by gradient plugin
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.4,
                    order: 1
                },
                {
                    id: 'secondary',
                    label: 'Secondary Rainbow',
                    data: dataCurve2,
                    borderColor: 'transparent', // will be replaced by gradient plugin
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.4,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            aspectRatio: 1,
            scales: {
                x: {
                    type: 'linear',
                    min: 400,
                    max: 800,
                    title: {
                        display: true,
                        text: 'f / THz'
                    }
                },
                y: {
                    min: 34,
                    max: 50,
                    title: {
                        display: true,
                        text: 'φ / °'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        font: {
                            family: 'Montserrat',
                            padding: 20
                        }
                    },
                    onClick: function (e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const dataset = legend.chart.data.datasets[index];
                        const id = dataset.id;

                        const meta = legend.chart.getDatasetMeta(index);
                        meta.hidden = !meta.hidden;

                        if (id && targetDatasetOpacities[id] !== undefined) {
                            targetDatasetOpacities[id] = meta.hidden ? 0 : 1;
                            if (!lastTimestamps[id]) {
                                requestAnimationFrame(ts => animateDatasetFade(id, ts));
                            }
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'REFRACTION ANGLE OF SINGLE AND DOUBLE RAINBOWS',
                    font: {
                        family: 'Montserrat',
                        size: 18,
                        weight: 'bold'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `f = ${ctx.parsed.x.toFixed(1)} THz, φ = ${ctx.parsed.y.toFixed(2)}°`,
                        title: () => null
                    }
                }
            }
        },
        plugins: [datasetFadePlugin, applyGradientPlugin]
    });
}




// === Initialization ===
window.onload = () => {

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
    document.getElementById('modeToggle4').addEventListener('click', () => switchMode(4));

    const freqSlider = document.getElementById('sliderF');
    if (freqSlider) {
        freqSlider.addEventListener('input', e => {
            f = parseFloat(e.target.value);
            updateValuesAndChart();
        });
    }

    document.querySelectorAll('.modeTwoShow, .modeThreeShow, .modeFourShow').forEach(el => {
        el.style.display = 'none';
    });
    
};
