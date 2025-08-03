// Configuration
const barConfig = {
  mouseSpeed:0.5,       // Mouse movement sensitivity (0.1-1)
  smoothing: 0.1,        // Movement smoothing (0.05-0.2)
  baseYOffset: 850,      // Vertical offset
  startXPosition: -50   // Initial horizontal position
};

// State variables
let mouseX = 0; // Normalized mouse position (-1 to 1)
let currentTranslateX = barConfig.startXPosition;
let barOne = document.querySelector('.barOne');

function updateBarPosition() {
  // Calculate target position based only on mouse
  const targetX = barConfig.startXPosition + 
                 (mouseX * window.innerWidth * barConfig.mouseSpeed);
  
  // Smooth interpolation
  currentTranslateX += (targetX - currentTranslateX) * barConfig.smoothing;
  
  // Apply your exact transform
  barOne.style.transform = `
    rotate(45deg)
    translate(${currentTranslateX}px, ${-currentTranslateX}px)
  `;
  
  requestAnimationFrame(updateBarPosition);
}

function handleMouseMove(e) {
  // Normalize mouse to -1 (left) to 1 (right)
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
}

function initBarAnimation() {
  // Set initial position (your exact starting transform)
  barOne.style.transform = `
    rotate(45deg)
    translate(${barConfig.startXPosition}px, ${barConfig.baseYOffset}px)
  `;
  
  // Set up mouse listener
  document.addEventListener('mousemove', handleMouseMove);
  
  // Start animation loop
  updateBarPosition();
}

// Your existing functions remain exactly the same
async function loadAnimation() {
  const loadingContainer = document.querySelector('.loading-container');
  formatTextLines();
  wrapWords();
  initBarAnimation(); // Changed from initScrollAnimation
  
  loadingContainer.addEventListener('transitionend', () => {
    animateWords();
  });
}

function formatTextLines() {
  const textOne = document.querySelector('.text-one');
  if (textOne) {
    textOne.innerHTML = `
      <div class="text-line">BPHO</div>
      <div class="text-line">COMPUTATIONAL</div>
      <div class="text-line">CHALLENGE</div>
      <div class="text-line">OPTICS 2025</div>
    `;
  }
}

function wrapWords() {
  const textLines = document.querySelectorAll('.text-line, .text-two');
  textLines.forEach(line => {
    const words = line.textContent.split(/(\s+)/);
    line.innerHTML = words.map(word => 
      word.trim() ? `<span class="word">${word}</span>` : `<span class="word-space">${word}</span>`
    ).join('');
  });
}

function animateWords() {
  const words = document.querySelectorAll('.word');
  const baseDelay = 0;
  const lineStagger = 0.2;
  const wordStagger = 0.1;
  
  let currentDelay = baseDelay;
  let currentLine = null;
  
  words.forEach(word => {
    const line = word.closest('.text-line, .text-two');
    if (line !== currentLine) {
      currentLine = line;
      currentDelay += lineStagger;
    }
    
    word.style.transitionDelay = `${currentDelay}s`;
    word.style.opacity = '1';
    word.style.transform = 'translateY(0)';
    
    currentDelay += wordStagger;
  });
}

loadAnimation();