// Loaded in <head> (not deferred) so the saved theme is applied before first paint.
(function () {
  var root = document.documentElement;
  var media = matchMedia('(prefers-color-scheme: dark)');
  var saved = localStorage.getItem('theme');
  root.dataset.theme = saved || (media.matches ? 'dark' : 'light');

  media.addEventListener('change', function (e) {
    if (!localStorage.getItem('theme')) root.dataset.theme = e.matches ? 'dark' : 'light';
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-theme-toggle]')) return;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', root.dataset.theme);
  });
})();
