// Adjustable parameters (to be linked to sliders later)
let y1 = 2;      // meters
let y2 = 2;      // meters
let L = 10;     // meters
let c = 299792458;    // speed of light (or wave speed), in m/s
let c1 = 200000000;    // speed of light (or wave speed), in m/s
let c2 = 200000000;    // speed of light (or wave speed), in m/s
let theta = 0;    // degrees
let phi = 0;    // degrees

let chart = null;

function computeT(x) {
    const n1 = c / c1;
    const n2 = c / c2;
    const d1 = Math.sqrt(x ** 2 + y1 ** 2);
    const d2 = Math.sqrt((L - x) ** 2 + y2 ** 2);
    const f1 = d1/(c / n1)
    const f2 = d2/(c / n2)
    return (f1 + f2);
}

// Generate data points
function generateDataPoints(step = 0.01) {
    const data = [];
    for (let x = 0; x < L; x += step) {
        const t = computeT(x);
        data.push({ x: x, y: t });
    }
    // Ensure last point at x = L is included
    const tEnd = computeT(L);
    data.push({ x: L, y: tEnd });

    return data;
}

function updateValuesAndChart() {
  // Update labels
  document.getElementById('y1Value').textContent = y1.toFixed(2);
  document.getElementById('y2Value').textContent = y2.toFixed(2);
  document.getElementById('LValue').textContent = L.toFixed(2);
  document.getElementById('c1Value').textContent = c1.toPrecision(3);
  document.getElementById('c2Value').textContent = c2.toPrecision(3);

  // Regenerate data
  const tData = generateDataPoints();
  const minPoint = tData.reduce((min, p) => (p.y < min.y ? p : min), tData[0]);

  // Update datasets
  chart.data.datasets[0].data = [{ x: minPoint.x, y: minPoint.y }];
  chart.data.datasets[0].label = `t = ${minPoint.y.toPrecision(3)} s`;

  chart.data.datasets[1].data = tData;

  chart.update();

  theta = Math.atan(minPoint.x / y1) * 180 / Math.PI;
  phi = Math.atan((L - minPoint.x) / y2) * 180 / Math.PI;

  document.getElementById('minX').textContent = minPoint.x.toFixed(2);
  document.getElementById('minY').textContent = minPoint.y.toPrecision(3);
  document.getElementById('theta').textContent = (theta).toFixed(2);
  document.getElementById('phi').textContent = (phi).toFixed(2);
  document.getElementById('sinThetaOverC1').textContent = (Math.sin(theta * Math.PI / 180)/c1).toPrecision(3);
  document.getElementById('sinPhiOverC2').textContent = (Math.sin(phi * Math.PI / 180)/c2).toPrecision(3);
}

const fadeDuration = 500; // fade duration in milliseconds
let dashedLineOpacity = 1; // current opacity of dashed line (0 to 1)
let targetOpacity = 1;      // target opacity
let lastTimestamp = null;

const highlightMinPlugin = {
  id: 'highlightMin',
  afterDraw(chart) {
    const crossDatasetIndex = chart.data.datasets.findIndex(ds => ds.isMinPoint);
    if (crossDatasetIndex === -1) return;

    const isVisible = chart.isDatasetVisible(crossDatasetIndex);

    // Set target opacity according to dataset visibility
    targetOpacity = isVisible ? 1 : 0;

    if (lastTimestamp === null) {
      lastTimestamp = performance.now();
      requestAnimationFrame(animateFade.bind(null, chart));
    }

    if (dashedLineOpacity > 0) {
      const minPoint = chart.data.datasets[crossDatasetIndex].data[0];
      const { ctx, scales: { x, y } } = chart;
      const px = x.getPixelForValue(minPoint.x);
      const py = y.getPixelForValue(minPoint.y);
      const x0 = x.left;

      ctx.save();
      ctx.globalAlpha = dashedLineOpacity;
      ctx.beginPath();
      ctx.moveTo(x0, py);
      ctx.lineTo(px, py);
      ctx.strokeStyle = 'rgb(255, 0, 0)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }
};

function animateFade(chart, timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  const opacityChange = dt / fadeDuration;

  if (dashedLineOpacity < targetOpacity) {
    dashedLineOpacity = Math.min(dashedLineOpacity + opacityChange, 1);
  } else if (dashedLineOpacity > targetOpacity) {
    dashedLineOpacity = Math.max(dashedLineOpacity - opacityChange, 0);
  }

  chart.draw();

  if (dashedLineOpacity !== targetOpacity) {
    requestAnimationFrame(animateFade.bind(null, chart));
  } else {
    lastTimestamp = null;
  }
}

const drawMinPointOverlayPlugin = {
  id: 'drawMinPointOverlay',
  afterDatasetsDraw(chart) {
    const dataset = chart.data.datasets.find(ds => ds.isMinPoint);
    if (!dataset || !dataset.data.length) return;

    if (dashedLineOpacity <= 0) return;  // skip drawing if fully transparent

    const ctx = chart.ctx;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;

    const point = dataset.data[0];
    const px = xScale.getPixelForValue(point.x);
    const py = yScale.getPixelForValue(point.y);

    ctx.save();
    ctx.globalAlpha = dashedLineOpacity;
    ctx.strokeStyle = 'rgb(255, 0, 0)';
    ctx.lineWidth = 1.5;

    const size = 6;
    ctx.beginPath();
    // Horizontal line of plus
    ctx.moveTo(px - size, py);
    ctx.lineTo(px + size, py);
    // Vertical line of plus
    ctx.moveTo(px, py - size);
    ctx.lineTo(px, py + size);
    ctx.stroke();

    ctx.restore();
  }
};

function loadGraph() {
    const tData = generateDataPoints();
    const minPoint = tData.reduce((min, p) => (p.y < min.y ? p : min), tData[0]);

    const config = {
        type: 'line',
        data: {
            datasets: [
                {
                    label: `x = ${minPoint.x.toFixed(2)}m, t = ${minPoint.y.toPrecision(3)}s`, // min point dataset label
                    data: [{ x: minPoint.x, y: minPoint.y }],
                    backgroundColor: 'rgb(255, 0, 0)',
                    borderColor: 'rgb(255, 0, 0)',
                    pointRadius: 0,
                    hoverRadius: 0,
                    showLine: false,
                    pointStyle: 'cross',
                    order: 10,
                    z: 10,
                    isMinPoint: true,
                },
                {
                    label: 't/s vs. x/m',
                    data: tData,
                    backgroundColor: '#00565d',
                    borderColor: '#00565d',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 20,
                    tension: 1,
                    order: 0,
                    z: 0,
                },
            ]
        },
        options: {
            responsive: true,
            aspectRatio: 1,
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'x / m',
                    },
                    ticks: {
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 't / s',
                    },
                    ticks: {
                        callback: function(value) {
                            // Format value to 3 significant figures
                            return Number.parseFloat(value).toPrecision(3);
                        },
                    }
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
                    display: true,
                    text: 'TRAVEL TIME OF LIGHT THROUGH REFRACTION',
                    font: {
                        family: 'Montserrat',
                        size: 18,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 0,
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const x = context.parsed.x.toFixed(2);
                            const y = context.parsed.y.toExponential(3);
                            return `x = ${x} m, t = ${y} s`;
                        },
                        title: () => null
                    },
                    titleFont: { family: 'Montserrat' },
                    bodyFont: { family: 'Montserrat' }
                }
            }
        },
        plugins: [highlightMinPlugin, drawMinPointOverlayPlugin]
    };

    const ctx = document.getElementById('chart-task-4').getContext('2d');
    chart = new Chart(ctx, config);  // Assign here
}

document.addEventListener('DOMContentLoaded', function () {
  loadGraph();

  // Add slider listeners
  document.getElementById('sliderY1').addEventListener('input', e => {
    y1 = parseFloat(e.target.value);
    updateValuesAndChart();
  });

  document.getElementById('sliderY2').addEventListener('input', e => {
    y2 = parseFloat(e.target.value);
    updateValuesAndChart();
  });

  document.getElementById('sliderL').addEventListener('input', e => {
    L = parseFloat(e.target.value);
    updateValuesAndChart();
  });

  document.getElementById('sliderC1').addEventListener('input', e => {
    c1 = parseFloat(e.target.value);
    updateValuesAndChart();
  });

  document.getElementById('sliderC2').addEventListener('input', e => {
    c2 = parseFloat(e.target.value);
    updateValuesAndChart();
  });
});