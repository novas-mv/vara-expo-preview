/* ---- mobile site nav ----------------------------------------------------
   Extracted verbatim from pages/home/index.html, which is the canonical nav.
   Home keeps its own inline copy; this is the shared one the seventeen
   generated pages load.

   Opens the header's own <nav class="links"> as a sheet below 1000px. The
   nav is display:none when closed, so it leaves the a11y tree on its own and
   there is no aria-hidden state to keep in sync — the only state is
   aria-expanded on the trigger. */
(function(){
  var bar = document.getElementById('topbar');
  var btn = document.getElementById('navtoggle');
  var nav = document.getElementById('sitenav');
  if (!bar || !btn || !nav) return;

  var MQ = window.matchMedia('(max-width:1000px)');

  function open(){
    bar.classList.add('navopen');
    btn.setAttribute('aria-expanded', 'true');
    /* lock the page behind the sheet */
    document.body.style.overflow = 'hidden';
    var first = nav.querySelector('a');
    if (first) first.focus();
  }
  function close(focus){
    bar.classList.remove('navopen');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (focus) btn.focus();
  }
  function isOpen(){ return bar.classList.contains('navopen'); }

  btn.addEventListener('click', function(){ isOpen() ? close() : open(); });

  /* a tap on a link navigates; close first so a same-page anchor is not left
     under an open sheet */
  nav.addEventListener('click', function(e){
    if (e.target.closest('a')) close();
  });

  document.addEventListener('keydown', function(e){
    if (!isOpen()) return;
    if (e.key === 'Escape'){ e.preventDefault(); close(true); return; }
    if (e.key !== 'Tab') return;
    /* keep focus inside the sheet: the trigger and the links are the loop */
    var items = [btn].concat([].slice.call(nav.querySelectorAll('a')));
    var i = items.indexOf(document.activeElement);
    if (i < 0) return;
    var n = e.shiftKey ? i - 1 : i + 1;
    e.preventDefault();
    items[(n + items.length) % items.length].focus();
  });

  /* NB: there is no "tap outside to close" — the sheet is full-screen, so
     there is no outside. The X and Escape are the ways out. */

  /* growing past the breakpoint restores the inline nav; the sheet must not
     be left open behind it */
  function sync(){ if (!MQ.matches && isOpen()) close(); }
  if (MQ.addEventListener) MQ.addEventListener('change', sync);
  else MQ.addListener(sync);
})();
