/* Atlas Visual Redesign v2 — Phase R0: professional icon system.
   Self-contained inline SVG (no external icon-font/CDN dependency — a
   failed request would silently blank every icon in the app). Replaces the
   84 emoji-as-icon occurrences (54 distinct) inventoried across the app.
   Usage: AtlasIcons.svg('home', {size:18}) returns an inline <svg> string;
   AtlasIcons.html(name, opts) is an alias for readability at call sites. */
window.AtlasIcons = (function(){
  'use strict';

  var PATHS = {
    /* navigation */
    home:        '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.5"/>',
    generate:     '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>',
    library:      '<path d="M5 4h3a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M19 4h-3a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z"/>',
    settings:     '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 17.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 13a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.65 6.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 2.65a1.7 1.7 0 0 0 1.04-1.56V1a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V7a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 13Z" stroke-width="1.3"/>',
    book:         '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"/>',
    /* converter steps */
    upload:       '<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    search:       '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
    sparkle:      '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/><circle cx="12" cy="12" r="3.2"/>',
    compass:      '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-6 2 2-6 6-2Z"/>',
    palette:      '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h1.8a3.2 3.2 0 0 0 3.2-3.2C20 6.9 16.4 3 12 3Z"/><circle cx="7.5" cy="11.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7" r="1.1" fill="currentColor" stroke="none"/>',
    rocket:       '<path d="M14.5 9.5c2-2 5-2.5 6-2 .5 1 0 4-2 6l-4 4-4-4 4-4Z"/><path d="m10.5 13.5-3 1-1.5 3.5 3.5-1.5 1-3Z"/><path d="M9 15c-1 1.5-1.5 3.5-1.5 5.5 2 0 4-.5 5.5-1.5"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/>',
    /* settings sections */
    server:       '<rect x="3.5" y="4" width="17" height="6.5" rx="1.5"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="1.5"/><path d="M7 7.2h.01M7 16.7h.01"/>',
    user:         '<circle cx="12" cy="8.5" r="3.5"/><path d="M4.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5"/>',
    card:         '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/><path d="M7 15h4"/>',
    logout:       '<path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2"/><path d="M9 12h11m0 0-3-3m3 3-3 3"/>',
    calendar:     '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/>',
    pause:        '<rect x="6" y="4.5" width="4.5" height="15" rx="1.2"/><rect x="13.5" y="4.5" width="4.5" height="15" rx="1.2"/>',
    /* misc chrome */
    ai:           '<path d="M9 3v4M9 18v3M4 10.5h4M14 10.5h6"/><circle cx="9" cy="10.5" r="3"/><path d="M16 15.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z"/>',
    crown:        '<path d="m4 8 3 3 5-6 5 6 3-3-1.5 10h-13L4 8Z"/><path d="M6.5 18h11"/>',
    save:         '<path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 4v5h7V4"/><path d="M8 13.5h8V20H8z"/>',
    lock:         '<rect x="4.5" y="10.5" width="15" height="9.5" rx="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    file:         '<path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5V8h4"/><path d="M8.5 12.5h7M8.5 16h5"/>',
    trash:        '<path d="M5 7h14"/><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><path d="M7 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4L17 7"/>',
    arrowLeft:    '<path d="M19 12H6M11 6l-6 6 6 6"/>',
    play:         '<path d="M7 5.5v13l11-6.5-11-6.5Z"/>',
    plus:         '<path d="M12 5v14M5 12h14"/>',
    camera:       '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5Z"/><circle cx="12" cy="13" r="3.4"/>',
    briefcase:    '<rect x="3.5" y="7.5" width="17" height="11" rx="1.8"/><path d="M8.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v1.5"/><path d="M3.5 12.5h17"/>',
    cart:         '<circle cx="10" cy="20" r="1.3" fill="currentColor" stroke="none"/><circle cx="17.5" cy="20" r="1.3" fill="currentColor" stroke="none"/><path d="M3.5 4h2.2l2 11.5h10l1.8-8H7"/>',
    target:       '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    checkCircle:  '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.6 2.6L16.3 9"/>',
    xCircle:      '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    alertTriangle:'<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.2"/><path d="M12 17.2h.01"/>',
    menu:         '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    x:            '<path d="M6 6l12 12M18 6 6 18"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronDown:  '<path d="m6 9 6 6 6-6"/>',
    refresh:      '<path d="M20 11a8 8 0 0 0-14.6-4.6M4 13a8 8 0 0 0 14.6 4.6"/><path d="M4 4v5h5M20 20v-5h-5"/>'
  };

  function svg(name, opts){
    opts = opts || {};
    var size = opts.size || 18;
    var strokeWidth = opts.strokeWidth || 1.75;
    var d = PATHS[name];
    if(!d) return '';
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+strokeWidth+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+d+'</svg>';
  }

  /* Declarative application: any element with data-icon="name" gets that
     icon's SVG injected (size/stroke-width overridable via data-icon-size/
     data-icon-stroke). Static App Shell markup is applied once on
     DOMContentLoaded below; dynamic render functions in later phases can
     call AtlasIcons.applyAll(container) again after inserting new markup. */
  function applyAll(root){
    (root || document).querySelectorAll('[data-icon]').forEach(function(el){
      if(el.dataset.iconApplied) return;
      var opts = {};
      if(el.dataset.iconSize) opts.size = parseInt(el.dataset.iconSize, 10);
      if(el.dataset.iconStroke) opts.strokeWidth = parseFloat(el.dataset.iconStroke);
      var markup = svg(el.getAttribute('data-icon'), opts);
      if(!markup) return;
      el.insertAdjacentHTML('afterbegin', markup);
      el.dataset.iconApplied = '1';
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ applyAll(); });
  } else {
    applyAll();
  }

  return { svg: svg, html: svg, names: Object.keys(PATHS), applyAll: applyAll };
})();
