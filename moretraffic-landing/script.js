// Section 02: type "yourwebsite.com" one character at a time.
// Figma timing: starts at 400ms, 73.33ms per character, inside a 22.2s loop.
(function () {
  var LOOP = 22200, START = 400, STEP = 73.333;
  var url = document.querySelector('.sec-how .url');
  if (!url) return;
  var text = 'yourwebsite.com';
  var css = '';
  for (var i = 0; i < text.length; i++) {
    var span = document.createElement('span');
    span.textContent = text[i];
    span.style.animation = 'type' + i + ' 22.2s linear infinite';
    url.appendChild(span);
    var a = ((START + i * STEP) / LOOP * 100).toFixed(3);
    var b = ((START + (i + 1) * STEP) / LOOP * 100).toFixed(3);
    css += '@keyframes type' + i + '{0%{opacity:0}' + a + '%{opacity:0}' + b + '%{opacity:1}100%{opacity:1}}';
  }
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

// Section 02: the animation stage is drawn at 1200px; scale it down on narrow screens.
(function () {
  var motion = document.querySelector('.sec-how .motion');
  if (!motion) return;
  function fit() {
    var avail = document.documentElement.clientWidth - 32;
    var s = Math.min(1, avail / 1200);
    motion.style.transform = s < 1 ? 'scale(' + s + ')' : '';
    motion.style.marginBottom = s < 1 ? (-(1 - s) * 680) + 'px' : '';
    motion.style.marginLeft = motion.style.marginRight = s < 1 ? (-(1 - s) * 600) + 'px' : '';
  }
  fit();
  window.addEventListener('resize', fit);
})();

// Section 04: tabs are clickable; the selected one expands.
(function () {
  var tabs = document.querySelectorAll('.sec-hood .tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
    });
  });
})();
