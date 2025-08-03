


// Cursor
function initCursor() {
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  document.body.appendChild(cursor);

  // List of selectors considered interactive
  const interactiveSelectors = [
    'a',
    'button',
    'input[type="submit"]',
    'input[type="button"]',
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="text"]',
    'input[type="email"]',
    'input[type="password"]',
    'textarea',
    'select',
    'label',
    '.hover-underline',
    '[onclick]',
    '[role="button"]',
    '[tabindex]',
    '[cursor="pointer"]'
  ].join(',');

  // Basic mouse tracking
  document.addEventListener('mousemove', (e) => {
    cursor.style.display = 'block';
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  });

  // Show/hide cursor on window enter/leave
  document.addEventListener('mouseenter', () => {
    cursor.style.display = 'block';
  });

  document.addEventListener('mouseleave', () => {
    cursor.style.display = 'none';
  });

  // Handle interactive elements hover
  document.addEventListener('mouseover', (e) => {
    const target = e.target;

    // Check if element or ancestors match interactive selectors
    const interactiveElement = target.closest(interactiveSelectors);

    // Check if computed style has cursor pointer as fallback
    const computedStyle = window.getComputedStyle(target);
    const hasPointerCursor = computedStyle.cursor === 'pointer';

    // Toggle pointer class if either condition is true
    cursor.classList.toggle('pointer', !!interactiveElement || hasPointerCursor);
  });
}



async function loadComponent(id, url) {
  const res = await fetch(url);
  const text = await res.text();
  document.getElementById(id).innerHTML = text;
}

function jump(target) {
  window.location.href = target;
}

async function initiatePage() {
  
  await Promise.all([
    loadComponent('header', 'components/header.html'),
    loadComponent('footer', 'components/footer.html')
  ]);


  initCursor();


  const nav = document.querySelector('.nav-container');
  const links = nav.querySelectorAll('.fade');


  links.forEach(link => {
    link.addEventListener('mouseenter', () => {
      if (link.classList.contains('hover-underline')) {
        link.style.setProperty('--underline-width', `${link.offsetWidth - 2}px`);
        links.forEach(el => {
          if (el !== link) el.style.color = '#474747';
        });
      }
    });

    link.addEventListener('mouseleave', () => {
      links.forEach(el => el.style.color = '#ffffff');
    });
  });

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  window.addEventListener('load', () => {
    window.scrollTo(0, 0);
  });


  const sl = new SiteLoader(
//    [
//      {
//        sources: [
//          {
//            sourceType: 'image',
//            selectors: ['.img-1']
//          }
//        ]
//      }
//    ]
  );

  const loadingBar = document.querySelector('.loading-colour');
  const loadingContainer = document.querySelector('.loading-container');
  const loadingNumber = document.querySelector('.loading-num');

  sl.addEventListener('progress', (e) => {
    loadingBar.style.transform = `translateX(-${100 - e.progress}%)`
  });

  sl.addEventListener('countComplete', () => {
    loadingNumber.textContent = "complete";
    document.body.style.overflow = 'auto';
    document.body.classList.add('hide-scrollbar');
    loadingContainer.classList.add('loading-disappear')
  });

  loadingContainer.addEventListener('transitionend', () => {
    loadingContainer.style.display = 'none'
  });

  sl.setTargetTextDom('.loading-num');
  sl.needSpeedUp = true;

  console.log(document.querySelectorAll('.selected'));

  sl.startLoad();

}

// Then initialize page
document.addEventListener('DOMContentLoaded', () => {
  initiatePage();
});

