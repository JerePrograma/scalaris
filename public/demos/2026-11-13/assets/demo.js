(() => {
  const dialog = document.querySelector('dialog');
  if (!dialog) return;
  const preview = document.querySelector('#preview-query');
  const select = document.querySelector('#topic');
  const detail = document.querySelector('#detail');
  const result = document.querySelector('#result');
  let opener;
  document.querySelectorAll('[data-open-demo]').forEach(button => button.addEventListener('click', () => {
    opener = button;
    result.hidden = true;
    const topic = button.dataset.topic;
    if (topic && [...select.options].some(o => o.value === topic)) select.value = topic;
    dialog.showModal();
  }));
  document.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => opener?.focus());
  dialog.addEventListener('click', e => {if (e.target === dialog) {const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  preview.addEventListener('click', () => {
    document.querySelector('#result-text').textContent = 'Hola, quisiera consultar por: ' + select.value + '.\n' + (detail.value.trim() || 'Acá aparecería el detalle de la consulta.');
    result.hidden = false;
    result.focus();
  });
})();
