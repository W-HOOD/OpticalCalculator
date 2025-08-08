const data_u = [20, 25, 30, 35, 40, 45, 50, 55];
const data_v = [65.5, 40, 31, 27, 25, 23.1, 21.5, 20.5];

const inv_u = data_u.map(x => 1 / x);
const inv_v = data_v.map(x => 1 / x);

const scatterPoints = inv_u.map((x, i) => ({
    x: x,
    y: inv_v[i]
}));

// Linear Regression
const n = scatterPoints.length;
const sumX = inv_u.reduce((a, b) => a + b, 0);
const sumY = inv_v.reduce((a, b) => a + b, 0);
const sumXY = inv_u.reduce((sum, x, i) => sum + x * inv_v[i], 0);
const sumX2 = inv_u.reduce((sum, x) => sum + x * x, 0);

const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
const intercept = (sumY - slope * sumX) / n;

const minX = Math.min(...inv_u);
const maxX = Math.max(...inv_u);
const regressionLine = [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept }
];

//Compute R²
const meanY = sumY / n;
const ssTot = inv_v.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
const ssRes = inv_u.reduce((sum, x, i) => {
    const yPred = slope * x + intercept;
    return sum + Math.pow(inv_v[i] - yPred, 2);
}, 0);
const rSquared = 1 - (ssRes / ssTot);


const focalDistance = 1 / intercept;

const originalColor = '#00221a';
const fadedColor = 'rgba(168, 168, 168, 0.3)';

function loadGraph() {
    const config = {
        type: 'scatter',
        data: {
            datasets: [
                {
                    type: 'scatter',
                    label: 'Scatter Plot',
                    data: scatterPoints,
                    pointStyle: 'cross',
                    backgroundColor: '#00221a',
                    borderColor: '#00221a',
                    showLine: false,
                    pointRadius: 6,
                    pointHoverRadius: 6,
                },
                {
                    label: 'Regression Line',
                    data: regressionLine,
                    type: 'line',
                    backgroundColor: 'rgb(0, 86, 93)',
                    borderColor: 'rgb(0, 86, 93)',
                    borderWidth: 1.5,
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            color: '000000',
            aspectRatio: 1,
            scales: {
                x: {
                    min: 0,
                    max: 0.06,
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: '1/u',
                    },
                    ticks: {
                    }
                },
                y: {
                    min: 0,
                    max: 0.06,
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: '1/v',
                    },
                    ticks: {
                    }
                }
            },
            plugins: {
                legend: {
                    color: '000000',
                    align: 'center',
                    labels: {
                        font: {
                            family: 'Montserrat',
                        }
                    }
                },
                title: {
                    color: '000000',
                    display: true,
                    text: 'GRAPH OF 1/v AGAINST 1/u',
                    align: 'center',
                    font: {
                        family: 'Montserrat',
                        size: 18,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 30
                    }
                },
                tooltip: {
                    bodyFont: {
                        family: 'Montserrat',
                    },
                    titleFont: {
                        family: 'Montserrat',
                    },
                    callbacks: {
                        label: function(context) {
                            const x = context.parsed.x.toFixed(3);
                            const y = context.parsed.y.toFixed(3);
                            return `(${x}, ${y})`;
                        }
                    }
                }
            },
            // Fade points on hover
            onHover: (event, activeElements, chart) => {
                const dataset = chart.data.datasets[0];
                if (activeElements.length > 0) {
                    const hoveredIndex = activeElements[0].index;
                    dataset.pointBorderColor = dataset.data.map((_, i) =>
                        i === hoveredIndex ? originalColor : fadedColor
                    );
                    dataset.pointBackgroundColor = dataset.data.map((_, i) =>
                        i === hoveredIndex ? originalColor : fadedColor
                    );
                } else {
                    dataset.pointBorderColor = Array(dataset.data.length).fill(originalColor);
                    dataset.pointBackgroundColor = Array(dataset.data.length).fill(originalColor);
                }
                chart.update();
            }
        }
    };

    const ctx = document.getElementById('chart-task-2').getContext('2d');
    new Chart(ctx, config);
}

function formatDecimal(num) {
    return num.toFixed(3);
}

// Populate the data table
function populateTable() {
    const table = document.getElementById('data-table');
    table.innerHTML = '';

    // Create thead
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['u/cm', 'v/cm', '1/u', '1/v'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create tbody
    const tbody = document.createElement('tbody');
    for (let i = 0; i < data_u.length; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data_u[i]}</td>
            <td>${data_v[i]}</td>
            <td>${formatDecimal(inv_u[i])}</td>
            <td>${formatDecimal(inv_v[i])}</td>
        `;
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
}


// Show equation and R²
function showEquation() {
    const equationDiv = document.getElementById('regression-equation-display');
    equationDiv.innerHTML = `
        Regression line: <strong>1/v = ${formatDecimal(slope)} × (1/u) + ${formatDecimal(intercept)}</strong><br>
        R² = <strong>${formatDecimal(rSquared)}</strong>
    `;
}

//Show focal distance
function showFocalDistance() {
    const focalDistanceDiv = document.getElementById('focal-distance-display');
    focalDistanceDiv.innerHTML = `
        Focal distance: ${formatDecimal(focalDistance)} cm &#8773; <strong>${focalDistance.toFixed(0)} cm</strong>
    `;
}

document.addEventListener('DOMContentLoaded', function () {

    loadGraph();
    populateTable();
    showEquation();
    showFocalDistance();

});



