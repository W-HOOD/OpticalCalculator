var x=[];
var y=[];
var temp = 0;
//Sellmeier coefficients for crown glass//
var bcrown=[1.03961212, 0.231792344, 1.01146945];
var ccrown=[0.00600069867, 0.0200179144, 103.560653];
let c = 300000000

//Create a new graph//
const graph = new Chart("graph", {
  type: "line",
  data: {
    datasets: [{
      backgroundColor:"rgba(255,255,255,1.0)",
      borderColor: "rgba(0,0,255,0.1)",
      data: x.map((xi, i) => ({ x: xi, y: y[i] })),
      label: "Refractive index of crown glass Vs Wavelength (nm)"
    }]
  },
  options:{
    scales: {
      y: { type: "linear", title: { display: true, text: 'Refractive Index (n)'} },
      x: {type:"linear",
        title: { display: true, text: 'Wavelength (nm)'},
        ticks: {
        }
      },
    },
    elements: {
      line: {
        borderWidth: 2,
      }
    },
    segment: {
      borderColor: ctx => {
        const index = ctx.p0DataIndex;
        let lambda;
        if (document.getElementById("input_choice").value == "wavelength") {
          lambda = x[index]; // x is wavelength in nm
        } else {
          lambda = (c / (x[index] * 1e12)) * 1e9;
        }
        return wavelengthToRGB(lambda);
      }
    },
    plugins: {},
  }
});
function wavelengthToRGB(lambda) {
  let R = 0, G = 0, B = 0;
  if (lambda < 380 || lambda > 750) return "rgb(0,0,0)";
  else if (lambda < 440) { R = -(lambda - 440) / (440 - 380); G = 0.0; B = 1.0; }
  else if (lambda < 490) { R = 0.0; G = (lambda - 440) / (490 - 440); B = 1.0; }
  else if (lambda < 510) { R = 0.0; G = 1.0; B = -(lambda - 510) / (510 - 490); }
  else if (lambda < 580) { R = (lambda - 510) / (580 - 510); G = 1.0; B = 0.0; }
  else if (lambda < 645) { R = 1.0; G = -(lambda - 645) / (645 - 580); B = 0.0; }
  else { R = 1.0; G = 0.0; B = 0.0; }
  R = Math.round(R * 255); G = Math.round(G * 255); B = Math.round(B * 255);
  return `rgb(${R},${G},${B})`;
}
function update(){
        x.length = 0;
        y.length = 0;
        var x_start = parseFloat(document.getElementById("x_start").value);
        var x_end = parseFloat(document.getElementById("x_end").value);
        // Show warning if max < min
      if (x_end < x_start) {
          document.getElementById("warningOverlay").style.display = "flex";
          return; // Stop further processing
      } else {
          document.getElementById("warningOverlay").style.display = "none";
      }

        if (document.getElementById("input_choice").value=="wavelength") {
            for (let i = x_start; i < x_end; i += ((x_end - x_start) / 10000)) { //simulate linspace as js does not have a builtin function.
                let temp = 0;
                let lambda = i/1000;  //convert nm to microns for equation
                for (let j = 0; j < 3; j++) {
                    temp += (bcrown[j] * (lambda ** 2)) / ((lambda ** 2) - ccrown[j]);  // use iterative formula and coefficients for crown glass to calculate refractive index
                }
                x.push(i); // Add wavelength to array x (in nm)
                y.push(Math.sqrt(1 + temp)); // Calculate refractive index and add to array y
            }
          graph.data.datasets[0].borderColor = x.map(lambda => wavelengthToRGB(lambda)); // Update border color based on wavelength
        }
        else {
            for (let i = x_start; i < x_end; i += ((x_end - x_start) / 10000)) {
              let frequencyHz = i * Math.pow(10, 12);
            
            // Apply the formula for refractive index
              let term = 1.731 - 0.261 * Math.pow(frequencyHz / Math.pow(10, 15), 2);
            
            // Calculate n (refractive index)
              let n = Math.sqrt(Math.sqrt(1 / term)+1);
              y.push(n);
              x.push(i);
              let f;
            }
        graph.data.datasets[0].borderColor = x.map(f => wavelengthToRGB(c/(f*(10**12))*10**9)); // Update border color based on frequency
        }
        graph.data.labels = x;
        graph.data.datasets[0].data = x.map((xi, i) => ({ x: xi, y: y[i] }));
        graph.data.datasets[0].label = document.getElementById("input_choice").value == "wavelength" ? "Refractive index of crown glass Vs Wavelength (nm)" : "Refractive index of water Vs Frequency (THz)";
        graph.options.scales.x.title.text = document.getElementById("input_choice").value == "wavelength" ? "Wavelength (nm)" : "Frequency (THz)";
        graph.options.scales.x.ticks.stepSize = 100;
        graph.update();
        console.log(x);
        console.log(y);
      }
main()
function main(){
    var input_choice = document.getElementById("input_choice");
    var input_start = document.getElementById("x_start");
    var input_end = document.getElementById("x_end");
    input_end.onchange = update;
    input_start.onchange = update;
    input_choice.onchange = update;
    }
window.onload = main;