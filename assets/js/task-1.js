// === Global Variables ===
let currentMode = 1;
let chart = null;

function switchMode(newMode) {
    if (newMode === currentMode) return;

    if (chart) {
        chart.destroy();
        chart = null;
    }

    document.querySelectorAll('.mode-toggle').forEach(label => {
        label.classList.remove('active-mode');
    });

    const activeLabel = document.querySelector(`label[for="modeToggle${newMode}"]`);
    if (activeLabel) {
        activeLabel.classList.add('active-mode');
    } else {
        console.warn(`Label for modeToggle${newMode} not found!`);
    }

    document.querySelectorAll('.modeOneShow, .modeTwoShow').forEach(el => {
        el.style.display = 'none';
    });

    switch (newMode) {
        case 1:
            document.querySelectorAll('.modeOneShow').forEach(el => el.style.display = '');
            loadTaskAGraph();
            break;
        case 2:
            document.querySelectorAll('.modeTwoShow').forEach(el => el.style.display = '');
            if (typeof loadTaskBGraph === 'function') loadTaskBGraph();
            break;
    }

    currentMode = newMode;
}

// === Constants ===
const C = 299792458;
const LAMBDA_VISIBLE_MIN = 380;
const LAMBDA_VISIBLE_MAX = 750;
const FREQ_VISIBLE_MIN = 405;
const FREQ_VISIBLE_MAX = 790;

// === Utility Functions ===
function interpolateColor([r1, g1, b1], [r2, g2, b2], factor) {
    return [
        Math.round(r1 + factor * (r2 - r1)),
        Math.round(g1 + factor * (g2 - g1)),
        Math.round(b1 + factor * (b2 - b1))
    ];
}

function wavelengthToRGB(lambda) {
    const colorStops = [
        { wl: 380, rgb: [148, 0, 211] },
        { wl: 450, rgb: [75, 0, 130] },
        { wl: 485, rgb: [0, 0, 255] },
        { wl: 500, rgb: [0, 255, 255] },
        { wl: 565, rgb: [0, 255, 0] },
        { wl: 590, rgb: [255, 255, 0] },
        { wl: 625, rgb: [255, 165, 0] },
        { wl: 750, rgb: [255, 0, 0] }
    ];

    const clamped = Math.min(Math.max(lambda, LAMBDA_VISIBLE_MIN), LAMBDA_VISIBLE_MAX);

    for (let i = 0; i < colorStops.length - 1; i++) {
        const lower = colorStops[i];
        const upper = colorStops[i + 1];

        if (clamped >= lower.wl && clamped <= upper.wl) {
            const factor = (clamped - lower.wl) / (upper.wl - lower.wl);
            const [r, g, b] = interpolateColor(lower.rgb, upper.rgb, factor);
            return { r, g, b };
        }
    }

    return { r: 0, g: 0, b: 0 };
}

function rgbString({ r, g, b }) {
    return `rgb(${r},${g},${b})`;
}

function freqToWavelength(fTHz) {
    return (C / (fTHz * 1e12)) * 1e9;
}

function freqToRGB(fTHz) {
    const wavelength = freqToWavelength(fTHz);
    return rgbString(wavelengthToRGB(wavelength));
}

function createSpectralGradient(ctx, widthPx, domainMin, domainMax, isFreq = false) {
    const gradient = ctx.createLinearGradient(0, 0, widthPx, 0);
    const steps = 100;

    for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        const value = domainMin + (domainMax - domainMin) * ratio;
        const color = isFreq ? freqToRGB(value) : rgbString(wavelengthToRGB(value));
        gradient.addColorStop(ratio, color);
    }

    return gradient;
}

function computeNFromF(f) {
    const f_scaled = (f * 1e12) / 1e15;
    const rhs = 1.731 - 0.261 * f_scaled * f_scaled;
    return Math.sqrt(1 + Math.pow(rhs, -0.5));
}

function crownGlassRefractiveIndex(lambda_nm) {
    const x = lambda_nm / 1000;
    const a = [1.03961212, 0.231792344, 1.01146945];
    const b = [0.00600069867, 0.0200179144, 103.560653];

    let y = 0;
    for (let i = 0; i < a.length; i++) {
        y += (a[i] * x * x) / (x * x - b[i]);
    }

    return Math.sqrt(1 + y);
}

function updateValuesAndChart() {
    switch (currentMode) {
        case 1: loadTaskAGraph(); break;
        case 2: loadTaskBGraph(); break;
    }
}

function loadTaskAGraph() {
    const lambdaMin = LAMBDA_VISIBLE_MIN;
    const lambdaMax = LAMBDA_VISIBLE_MAX;
    const step = 5;
    const data = [];

    for (let lambda = lambdaMin; lambda <= lambdaMax; lambda += step) {
        data.push({ x: lambda, y: crownGlassRefractiveIndex(lambda) });
    }

    const applyGradientPlugin = {
        id: 'applyGradientPlugin',
        afterLayout(chart, args, options) {
            if (!chart._gradientApplied) {
                const ctx = chart.ctx;
                const width = chart.width;
                const gradient = createSpectralGradient(ctx, width, lambdaMin, lambdaMax);
                chart.data.datasets.forEach(ds => ds.borderColor = gradient);
                chart._gradientApplied = true;
                chart.update();
            }
        }
    };

    if (chart) chart.destroy();

    const ctx = document.getElementById('chart-task-1').getContext('2d');

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    id: 'refractiveIndexCrownGlass',
                    label: 'Crown Glass',
                    data,
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.4
                }
            ]
        },
        options: {
            color: '#000000',
            responsive: true,
            aspectRatio: 1,
            scales: {
                x: {
                    type: 'linear',
                    min: 350,
                    max: lambdaMax,
                    title: { display: true, text: 'λ / nm' }
                },
                y: {
                    min: 1.50,
                    max: 1.54,
                    title: { display: true, text: 'n' }
                }
            },
            plugins: {
                legend: { 
                  labels: { 
                    font: { 
                      family: 'Montserrat' 
                    } 
                  } 
                },
                title: {
                    color: '#000000',
                    display: true,
                    text: 'REFRACTIVE INDEX OF CROWN GLASS',
                    font: { family: 'Montserrat', size: 18, weight: 'bold' }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `λ = ${ctx.parsed.x} nm, n = ${ctx.parsed.y.toFixed(5)}`,
                        title: () => null
                    }
                }
            }
        },
        plugins: [applyGradientPlugin]
    });
}


function loadTaskBGraph() {
    const freqMin = FREQ_VISIBLE_MIN;
    const freqMax = FREQ_VISIBLE_MAX;
    const step = 5;
    const data = [];

    for (let f = freqMin; f <= freqMax; f += step) {
        data.push({ x: f, y: computeNFromF(f) });
    }

    const applySpectralGradientPlugin = {
        id: 'applySpectralGradientPlugin',
        afterLayout(chartInstance) {
            if (!chartInstance._gradientApplied) {
                const gradient = createSpectralGradient(chartInstance.ctx, chartInstance.width, freqMin, freqMax, true);
                chartInstance.data.datasets.forEach(ds => ds.borderColor = gradient);
                chartInstance._gradientApplied = true;
                chartInstance.update();
            }
        }
    };

    const ctx = document.getElementById('chart-task-1').getContext('2d');

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    id: 'refractiveIndexWaterFreq',
                    label: 'Water',
                    data,
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.4
                }
            ]
        },
        options: {
            color: '000000',
            responsive: true,
            aspectRatio: 1,
            scales: {
                x: {
                    type: 'linear',
                    min: 400,
                    max: 800,
                    title: { display: true, text: 'f / THz' }
                },
                y: {
                    min: 1.32,
                    max: 1.35,
                    title: { display: true, text: 'n' }
                }
            },
            plugins: {
                color: '000000',
                legend: { 
                  labels: { 
                    font: { 
                      family: 'Montserrat' 
                    } 
                  } 
                },
                title: {
                    color: '000000',
                    display: true,
                    text: 'REFRACTIVE INDEX OF WATER',
                    font: { family: 'Montserrat', size: 18, weight: 'bold' }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `f = ${ctx.parsed.x.toFixed(2)} THz, n = ${ctx.parsed.y.toFixed(5)}`,
                        title: () => null
                    }
                }
            }
        },
        plugins: [applySpectralGradientPlugin]
    });
}

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
    document.querySelectorAll('.modeTwoShow').forEach(el => el.style.display = 'none');
};
