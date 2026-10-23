/* Fahrzeugwerkstatt 2.3.3 – nur Push-Benachrichtigungen.
   Keine Eingriffe in Familie, Titelbilder, Werkstattdaten oder Cloud-Sync. */
(function () {
  'use strict';
  const PUSH_QUERY = 'fw_push';
  const PUSH_PAGE = 'family';
  const ID = 'fw-push-settings';
  let working = false;
  let prepared = null;
  let preparing = false;
  let initialLinkPending = new URL(location.href).searchParams.get(PUSH_QUERY) === PUSH_PAGE;

  function transport() {
    const t = window.fwCloud && window.fwCloud.transport;
    if (!t || !t.session) throw new Error('Bitte zuerst unter „Abgleich & Geräte“ bei Supabase anmelden.');
    return t;
  }
  async function api(action, payload) {
    const t = transport();
    const method = action === 'config' ? 'GET' : 'POST';
    const response = await t.raw('/functions/v1/fw-webpush', {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
      ...(method === 'POST' ? { body: JSON.stringify({ action, ...payload }) } : {})
    });
    let body;
    try { body = await response.json(); } catch { throw new Error('Push-Dienst liefert keine gültige Antwort.'); }
    if (!response.ok || !body.ok) throw new Error(body.error || 'Push-Dienst nicht erreichbar (' + response.status + ').');
    return body;
  }
  function supported() {
    return location.protocol === 'https:' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
  }
  function base64UrlToBytes(raw) {
    if (!/^[A-Za-z0-9_-]{60,120}$/.test(raw)) throw new Error('Der öffentliche Push-Schlüssel ist ungültig.');
    const pad = '='.repeat((4 - raw.length % 4) % 4);
    const bin = atob(raw.replace(/-/g, '+').replace(/_/g, '/') + pad);
    return Uint8Array.from(bin, ch => ch.charCodeAt(0));
  }
  const statusNode = () => document.querySelector('#' + ID + ' [data-fw-push-status]');
  function status(s, error) {
    const node = statusNode();
    if (node) {
      node.textContent = s;
      node.style.color = error ? '#f5bb99' : '';
    }
  }
  function buttonsDisabled(flag) {
    document.querySelectorAll('#' + ID + ' [data-fw-push-action]').forEach(button => {
      button.disabled = flag || (button.dataset.fwPushAction === 'enable' && !prepared);
    });
  }
  async function activeSubscription() {
    const registration = await navigator.serviceWorker.ready;
    return { registration, subscription: await registration.pushManager.getSubscription() };
  }
  async function enablePush() {
    if (!supported()) throw new Error('Web-Push ist hier nicht verfügbar. Auf dem iPhone muss die App vom Home-Bildschirm geöffnet werden (iOS 16.4 oder neuer).');
    if (!prepared) throw new Error('Die Push-Verbindung ist noch nicht bereit. Prüfe die Cloud-Anmeldung und versuche es erneut.');
    // Key and service worker were prepared *before* the tap. iOS requires the
    // permission prompt to start from a direct user gesture, without network waits.
    const permissionTask = Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission);
    if (await permissionTask !== 'granted') throw new Error('Mitteilungen wurden nicht erlaubt. Prüfe die iPhone-Einstellungen für die Werkstatt.');
    status('Dieses iPhone wird angemeldet …');
    const { registration, key } = prepared;
    const oldSubscription = await registration.pushManager.getSubscription();
    let sub = oldSubscription;
    if (sub && sub.options && sub.options.applicationServerKey) {
      const existing = new Uint8Array(sub.options.applicationServerKey);
      if (existing.length !== key.length || existing.some((x, i) => x !== key[i])) {
        if (!await sub.unsubscribe()) throw new Error('Die alte Push-Registrierung konnte nicht ersetzt werden.');
        sub = null;
      }
    }
    if (!sub) sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    try {
      await api('subscribe', { subscription: sub.toJSON() });
    } catch (err) {
      // Avoid leaving a registered-but-undeliverable subscription on this device.
      if (!oldSubscription) await sub.unsubscribe().catch(() => {});
      throw err;
    }
    status('Aktiviert. Neue Mängel, Wartungs- und HU-Meldungen können auf diesem iPhone erscheinen.');
  }
  async function disablePush() {
    if (!supported()) throw new Error('Web-Push ist auf diesem Gerät nicht verfügbar.');
    const { subscription } = await activeSubscription();
    if (!subscription) { status('Auf diesem Gerät ist Push bereits deaktiviert.'); return; }
    await api('unsubscribe', { endpoint: subscription.endpoint });
    if (!await subscription.unsubscribe()) throw new Error('Server abgemeldet, aber iPhone konnte die lokale Push-Registrierung nicht beenden.');
    status('Push-Benachrichtigungen auf diesem Gerät deaktiviert.');
  }
  async function testPush() {
    if (!supported() || Notification.permission !== 'granted') throw new Error('Bitte zunächst Push aktivieren und erlauben.');
    const { subscription } = await activeSubscription();
    if (!subscription) throw new Error('Bitte zunächst dieses iPhone registrieren.');
    const result = await api('test', { endpoint: subscription.endpoint });
    status(result.sent ? 'Test an den Push-Dienst übermittelt. Prüfe den iPhone-Sperrbildschirm.' : 'Test konnte nicht zugestellt werden. Siehe Supabase-Funktionsprotokoll.');
  }
  async function updateStatus() {
    const panel = document.getElementById(ID);
    if (!panel || preparing) return;
    const enable = panel.querySelector('[data-fw-push-action="enable"]');
    if (!supported()) { status('Dieses Gerät unterstützt hier kein Web-Push. Auf dem iPhone über das Home-Bildschirm-Symbol öffnen.'); return; }
    if (Notification.permission === 'denied') { status('Benachrichtigungen sind auf diesem Gerät gesperrt.', true); return; }
    if (!window.fwCloud?.transport?.session) {
      prepared = null;
      status('Bitte zuerst unter „Abgleich & Geräte“ anmelden.');
      return;
    }
    preparing = true;
    try {
      status('Push-Verbindung wird geprüft …');
      const [data, registration] = await Promise.all([api('config'), navigator.serviceWorker.ready]);
      if (!panel.isConnected) return;
      prepared = { registration, key: base64UrlToBytes(data.publicKey) };
      enable.disabled = false;
      const subscription = await registration.pushManager.getSubscription();
      status(subscription ? 'Dieses Gerät besitzt bereits eine Push-Registrierung. Test senden oder erneut aktivieren.' : 'Bereit: Zum Aktivieren auf den Button tippen.');
    } catch (e) {
      prepared = null;
      status(e?.message || 'Push-Server noch nicht bereit. Bitte Cloud-Anmeldung prüfen.', true);
    } finally { preparing = false; }
  }
  async function handleAction(button) {
    if (working) return;
    working = true;
    buttonsDisabled(true);
    try {
      const action = button.dataset.fwPushAction;
      if (action === 'enable') await enablePush();
      else if (action === 'disable') await disablePush();
      else if (action === 'test') await testPush();
    } catch (e) { status(e && e.message ? e.message : 'Unbekannter Push-Fehler.', true); }
    finally { working = false; buttonsDisabled(false); }
  }
  // New settings are attached after the existing cloud panel. The old renderer is not edited.
  function attach() {
    const existing = document.querySelector('.cloudbox');
    if (!existing || document.getElementById(ID)) return;
    const block = document.createElement('section');
    block.id = ID;
    block.className = 'cloud-card';
    block.innerHTML = '<h2>🔔 iPhone-Push-Benachrichtigungen</h2>' +
      '<p>Benachrichtigung bei neuen Mängeln, Wartungen oder HU-Meldungen der Familie. Kilometerstände bleiben still.</p>' +
      '<div class="cloud-actions">' +
      '<button type="button" data-fw-push-action="enable">Auf diesem iPhone aktivieren</button>' +
      '<button type="button" data-fw-push-action="test">Test senden</button>' +
      '<button type="button" data-fw-push-action="disable">Deaktivieren</button>' +
      '</div><p role="status" aria-live="polite" class="cloud-small" data-fw-push-status>Push-Status wird geprüft …</p>' +
      '<p class="cloud-small">Die Einrichtung wirkt nur auf dieses Gerät. Fahrzeugdaten und Bilder bleiben unverändert.</p>';
    // A registered service worker and a public VAPID key are loaded in advance.
    // Until they are ready, activating push cannot accidentally lose iOS's tap gesture.
    block.querySelector('[data-fw-push-action="enable"]').disabled = true;
    existing.appendChild(block);
    updateStatus();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-fw-push-action]');
    if (!button) return;
    event.preventDefault();
    // Call the permission path synchronously (no await before the event handler begins).
    void handleAction(button);
  });
  const observer = new MutationObserver(attach);
  observer.observe(document.getElementById('root') || document.documentElement, { childList: true, subtree: true });
  attach();

  function navigateFamily() {
    // Existing work must never be discarded because of a notification click.
    if (typeof mobileEditing !== 'undefined' && (mobileEditing || (typeof mobileSaving !== 'undefined' && mobileSaving))) return false;
    if (!window.fwCloud || typeof app === 'undefined' || typeof render !== 'function' || typeof FWFamilyAdmin === 'undefined') return false;
    app.page = 'family';
    render();
    FWFamilyAdmin.load().catch(() => {});
    return true;
  }
  function consumeLink() {
    if (!initialLinkPending) return;
    if (navigateFamily()) {
      initialLinkPending = false;
      const url = new URL(location.href);
      url.searchParams.delete(PUSH_QUERY);
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  }
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'FW_PUSH_OPEN_FAMILY') {
      if (!navigateFamily()) status('Öffne nach dem Speichern unter „Mehr“ die Familienmeldungen.');
    }
  });
  const linkObserver = new MutationObserver(consumeLink);
  linkObserver.observe(document.getElementById('root') || document.documentElement, { childList: true });
  consumeLink();
  window.addEventListener('pageshow', consumeLink);
})();
