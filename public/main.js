// Shared progressive navigation. The links remain available when JavaScript is off.
document.documentElement.classList.add('nav-enhanced');
for (const header of document.querySelectorAll('.site-header')) {
  const toggle = header.querySelector('.nav-toggle');
  const navigation = header.querySelector('.site-nav');
  if (!toggle || !navigation) continue;
  const close = (restoreFocus = false) => {
    const wasOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú de navegación');
    navigation.classList.remove('is-open');
    if (restoreFocus && wasOpen) toggle.focus();
  };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close(true);
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) close();
  });
  const desktop = window.matchMedia('(min-width: 861px)');
  desktop.addEventListener('change', () => close());
}
