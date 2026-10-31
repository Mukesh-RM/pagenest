(function () {
  var screens = {
    library: 'Library', collections: 'Collections', stats: 'Stats', settings: 'Settings'
  };
  var main = document.getElementById('screen');
  var sheetRoot = document.getElementById('sheet-root');
  var opener = null;

  function currentTheme() { return document.documentElement.dataset.theme; }

  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('pagenest-theme', t); } catch (e) { /* storage unavailable */ }
  }

  function closeSheet() {
    sheetRoot.innerHTML = '';
    if (opener) { opener.focus(); opener = null; }
  }

  function openSheet(trigger) {
    opener = trigger;
    sheetRoot.innerHTML =
      '<div role="dialog" aria-modal="true" aria-labelledby="sheet-title" class="sheet">' +
      '<h2 id="sheet-title">Install help</h2>' +
      '<p>Open the share menu and choose Add to Home Screen.</p>' +
      '<button type="button" id="sheet-close">Close</button></div>';
    document.getElementById('sheet-close').addEventListener('click', closeSheet);
    document.getElementById('sheet-close').focus();
    history.pushState({ sheet: true }, '');
  }

  function render() {
    closeSheetSilently();
    var key = (location.hash.replace('#/', '') || 'library');
    if (!screens[key]) key = 'library';
    var title = screens[key];
    var html = '<h1>' + title + '</h1>';
    if (key === 'library') html += '<p>Add your first book.</p>';
    if (key === 'settings') {
      html += '<fieldset role="radiogroup" aria-labelledby="theme-legend"><legend id="theme-legend">Theme</legend>';
      ['Light', 'Sepia', 'Dark', 'Black'].forEach(function (name) {
        var id = name.toLowerCase();
        html += '<label><input type="radio" name="theme" value="' + id + '"' +
          (currentTheme() === id ? ' checked' : '') + '> ' + name + '</label> ';
      });
      html += '</fieldset><button type="button" id="open-sheet">Install help</button>';
    }
    main.innerHTML = html;
    document.title = title + ' · InkQuiet';
    document.querySelectorAll('nav a').forEach(function (a) {
      if (a.getAttribute('href') === '#/' + key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('input[name="theme"]').forEach(function (r) {
      r.addEventListener('change', function () { setTheme(r.value); });
    });
    var btn = document.getElementById('open-sheet');
    if (btn) btn.addEventListener('click', function () { openSheet(btn); });
  }

  function closeSheetSilently() { sheetRoot.innerHTML = ''; }

  document.addEventListener('keydown', function (e) {
    if (!sheetRoot.firstChild) return;
    if (e.key === 'Escape') { history.back(); return; }
    if (e.key === 'Tab') {
      // keep focus inside the modal sheet
      var items = sheetRoot.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
      var first = items[0], last = items[items.length - 1];
      if (!sheetRoot.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('popstate', function () {
    if (sheetRoot.firstChild) closeSheet();
  });
  window.addEventListener('hashchange', render);

  try {
    var saved = localStorage.getItem('pagenest-theme');
    if (saved) document.documentElement.dataset.theme = saved;
  } catch (e) { /* storage unavailable */ }
  render();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
