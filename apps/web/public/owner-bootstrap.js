// Consume owner authority before loading the application and remove it from history.
(() => {
  if (location.pathname !== '/console') return;
  const token = new URLSearchParams(location.hash.slice(1)).get('owner');
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    history.replaceState(null, '', location.pathname + location.search);
    sessionStorage.setItem('wahlet-owner', token);
  }
})();
