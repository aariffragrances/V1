'use strict';
/* Scroll animations + misc enhancements */
(function () {
  /* Fade-in sections on scroll */
  const css = `.fade-in-section{opacity:0;transform:translateY(22px);transition:opacity .55s ease,transform .55s ease}
    .fade-in-section.visible{opacity:1;transform:none}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
