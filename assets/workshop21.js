/* Mobile 2.1: private equipment, ideas and source-backed vehicle profiles.
   All personal records use the existing transaction and synchronization adapter. */
'use strict';
(function () {
  const cash = cents => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(cents || 0) / 100);
  const categories = ['Werkzeug', 'Diagnosegerät', 'Ladegerät', 'Zubehör', 'Sonstiges'];
  const statuses = ['Neu', 'Geplant', 'In Arbeit', 'Umgesetzt'];
  const catalogState = { query: '', brand: '', offset: 0, limit: 20 };
  const profileState = { offset: 0, limit: 12 };
  const catalog = () => window.FWCatalog21;
  const profiles = () => window.FW_INTERVALS_21 || [];
  const resultFor = v => catalog()?.match(v, app.brands) || { status: 'none', variants: [], profiles: [], reason: 'Der Katalog ist noch nicht verfügbar.', profile_status: 'none', profile_reason: 'Der Wartungskatalog ist noch nicht geladen.' };
  const statusLabel = s => ({ exact: 'Technische Variante zugeordnet', ambiguous: 'Mehrere technische Varianten', incomplete: 'Technische Angaben ergänzen', none: 'Kein technischer Datensatz' }[s] || 'Technische Zuordnung prüfen');
  const numberLabel = value => Number(value || 0).toLocaleString('de-DE');
  function profileSummary(result) {
    const count = (result.profiles || []).length;
    const status = result.profile_status || (count > 1 ? 'ambiguous' : count ? 'incomplete' : 'none');
    const label = { exact: 'Quellenprofil gefunden', ambiguous: 'Mehrere Quellenprofile', incomplete: count ? 'Vorschlag prüfen' : 'Angaben ergänzen', none: 'Kein Quellenprofil' }[status] || 'Profil prüfen';
    const reason = result.profile_reason || (count ? 'Quellenprofil vorgeschlagen. Geltungsbereich der Quelle prüfen.' : 'Für diese Fahrzeugangaben ist noch kein passendes Wartungsprofil hinterlegt.');
    return { status, label, reason };
  }
  function coveredBrandCount(stats) {
    return stats.brandsWithVerifiedIntervals ?? new Set(profiles().filter(p => (p.items || []).some(i => i.verified === true && (i.km != null || i.months != null))).map(p => p.brand).filter(Boolean)).size;
  }

  function sourceLink(source, title = 'Originalquelle öffnen') {
    const url = typeof source === 'string' ? source : source?.url;
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) return '';
      return `<a class="external" href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`;
    } catch { return ''; }
  }

  function intervalCard(p) { return FW22.profileCard(p); }

  const searchText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE');
  function profileSearch(c) {
    const request = { brand: catalogState.brand, query: catalogState.query, ...profileState };
    if (c?.searchProfiles) return c.searchProfiles(request);
    const words = searchText(request.query).split(/\s+/).filter(Boolean);
    const matched = profiles().filter(p => (!request.brand || searchText(p.brand) === searchText(request.brand)) && words.every(word => searchText([p.brand, p.model, p.variant, p.engine, (p.engine_contains || []).join(' '), p.fuel, p.market, p.condition, ...(p.items || []).map(i => [i.task, i.condition].join(' '))].filter(Boolean).join(' ')).includes(word)));
    return { items: matched.slice(request.offset, request.offset + request.limit), total: matched.length, offset: request.offset, limit: request.limit };
  }

  function pageControls(result, state, attribute, label) {
    const start = result.total ? state.offset + 1 : 0;
    const end = Math.min(state.offset + state.limit, result.total);
    return `<div class="fw21-pages"><button class="btn secondary" ${attribute}="previous" aria-label="Vorherige Seite: ${esc(label)}" ${state.offset === 0 ? 'disabled' : ''}>← Zurück</button><span class="small muted">${start}–${end} / ${Number(result.total).toLocaleString('de-DE')}</span><button class="btn secondary" ${attribute}="next" aria-label="Nächste Seite: ${esc(label)}" ${end >= result.total ? 'disabled' : ''}>Weitere →</button></div>`;
  }

  function variantCard(v) {
    const years = v.year_from === v.year_to ? v.year_from : `${v.year_from || '?'}–${v.year_to || '?'}`;
    const attributes = [v.engine, v.fuel, v.power_kw ? `${v.power_kw} kW` : '', v.hsn && v.tsn ? `${v.hsn} / ${v.tsn}` : '', v.market].filter(Boolean);
    return `<article class="panel fw21-variant"><div class="title-row"><h3>${esc(v.brand + ' ' + (v.variant || v.model))}</h3><span class="pill">${esc(years)}</span></div><p class="small muted">${esc(attributes.join(' · '))}</p>${sourceLink(v.source, 'Quelle der Fahrzeugvariante')}<p class="small muted fw21-catalog-note">Ein Katalogtreffer bestätigt die Fahrzeugvariante. Wartungswerte gelten nur mit passender Wartungsquelle.</p></article>`;
  }

  function vehicleAddition(v) {
    const found = resultFor(v);
    const primary = profileSummary(found);
    return `<section class="fw21-detail"><h2>Inspektionen & Intervalle</h2><div class="panel" data-fw21-profile-match><h3>Wartungsprofilabgleich</h3><span class="pill ${primary.status === 'exact' ? '' : 'warn'}">${esc(primary.label)}</span><p>${esc(primary.reason)}</p><p class="small muted">Der Abgleich zeigt Quellen und Vorschläge. Einzelne Arbeiten kannst du nach Prüfung übernehmen; bestehende Termine bleiben unverändert.</p><details class="fw21-technical-match"><summary>Technische Fahrzeugdaten (optional)</summary><p><span class="pill">${esc(statusLabel(found.status))}</span></p><p class="small muted">${esc(found.reason || '')}</p>${found.variants?.length ? `<p class="small muted">${found.variants.slice(0, 5).map(row => esc([row.brand, row.variant || row.model].join(' '))).join('<br>')}</p>${found.variants.length > 5 ? `<p class="small muted">${found.variants.length} mögliche technische Varianten.</p>` : ''}` : ''}</details><button class="btn secondary" data-fw21-nav="intervals21">Katalog öffnen</button></div>${(found.profiles || []).map(intervalCard).join('')}${!found.profiles?.length ? '<p class="notice">Für diese Fahrzeugangaben ist noch kein passendes Wartungsprofil belegt. Fehlende Fristen bleiben offen.</p>' : ''}</section>`;
  }

  const oldDetails = vehicleDetails;
  vehicleDetails = function (v) { return oldDetails(v) + vehicleAddition(v); };

  const oldMore = more;
  more = function () {
    return oldMore() + `<section class="panel fw21-menu"><h2>Deine Ausstattung & Fahrzeugprofile</h2><div class="fw21-menu-buttons"><button class="btn secondary" data-fw21-nav="equipment21">🧰 Meine Ausrüstung</button><button class="btn secondary" data-fw21-nav="intervals21">◷ Inspektionen & Intervalle</button></div></section><section class="panel fw21-ideas-bottom"><button class="btn orange" data-fw21-nav="ideas21">💡 Ideenbox <span aria-hidden="true">→</span></button><p class="small muted">Verbesserungswünsche direkt beim Schrauben festhalten.</p></section>`;
  };

  function listPage(page) {
    const kind = page === 'equipment21' ? 'equipment' : 'ideas';
    const items = rows(kind).slice().sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    const equipmentTotal = rows('equipment').reduce((n, x) => n + Number(x.amount_cents || 0), 0);
    const vehicleTotal = rows('expenses').reduce((n, x) => n + Number(x.amount_cents || 0), 0);
    return `${cloudStrip()}<button class="back" data-fw21-nav="more">← Mehr</button><h1 class="fw21-page-title">${kind === 'equipment' ? 'Meine Ausrüstung' : 'Ideenbox'}</h1>${kind === 'equipment' ? `<p class="muted">Deine Werkzeuge und Geräte, übersichtlich an einem Ort.</p><div class="fw21-costs"><div class="panel fw21-total"><small>Ausrüstung · ${items.length} Einträge</small><b>${cash(equipmentTotal)}</b></div><div class="panel fw21-total"><small>Fahrzeugkosten · separat</small><b>${cash(vehicleTotal)}</b></div></div>` : '<p class="muted">Gedanken und Wünsche für deine Werkstatt festhalten.</p>'}<button class="btn orange" data-fw21-new="${kind}">+ ${kind === 'ideas' ? 'Idee' : 'Ausrüstung'} hinzufügen</button><div class="fw21-list">${items.map(x => `<article class="panel"><div class="title-row"><h2>${esc(x.title || x.name)}</h2>${kind === 'equipment' ? `<b class="fw21-price">${cash(x.amount_cents)}</b>` : `<span class="pill ${x.status === 'Umgesetzt' ? '' : 'warn'}">${esc(x.status || 'Neu')}</span>`}</div>${kind === 'equipment' ? `<p class="small muted">${esc(x.category || 'Sonstiges')}${x.purchased_at ? ' · ' + esc(fmtDate(x.purchased_at)) : ''}</p>` : ''}${x.description || x.notes ? `<p class="fw21-notes">${esc(x.description || x.notes)}</p>` : ''}<div class="actions"><button class="btn secondary" data-fw21-edit="${kind}:${esc(x.id)}">Bearbeiten</button><button class="back fw21-delete" data-fw21-del="${kind}:${esc(x.id)}" aria-label="${esc((x.title || x.name) + ' löschen')}">Löschen</button></div></article>`).join('') || `<div class="empty"><p>${kind === 'equipment' ? 'Noch keine Ausrüstung eingetragen.' : 'Deine Ideenbox ist noch leer.'}</p><p class="small">${kind === 'equipment' ? 'Beginne zum Beispiel mit deinem Diagnosegerät oder einem Werkzeug.' : 'Hier ist Platz für den nächsten Einfall.'}</p></div>`}</div>`;
  }

  function intervalPage() {
    const c = catalog();
    let result = c?.search(catalogState) || { items: [], total: 0 };
    let profileResult = profileSearch(c);
    if (catalogState.offset >= result.total && catalogState.offset) { catalogState.offset = 0; result = c?.search(catalogState) || { items: [], total: 0 }; }
    if (profileState.offset >= profileResult.total && profileState.offset) { profileState.offset = 0; profileResult = profileSearch(c); }
    const stats = c?.stats || { variants: 0, profiles: profiles().length, verifiedIntervals: 0 };
    const brands = [...new Set([...(c?.brands || []), ...profiles().map(p => p.brand)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    const scopes = Number.isSafeInteger(stats.vehicleScopes) ? stats.vehicleScopes : null;
    return `${cloudStrip()}<button class="back" data-fw21-nav="more">← Mehr</button><h1 class="fw21-page-title">Inspektionen & Intervalle</h1><p class="muted">Wartungsquellen für Fahrzeuge in Deutschland und Europa nachschlagen.</p><div class="panel"><div class="fw21-catalog-stats"><p><b>${esc(numberLabel(stats.profiles))} Quellenprofile</b></p><p><b>${esc(numberLabel(coveredBrandCount(stats)))} Marken mit Zahlenintervallen</b></p><p><b>${esc(numberLabel(stats.verifiedIntervals))} numerische Intervallangaben</b></p></div><p class="small muted">Ergänzend: ${esc(numberLabel(stats.variants))} technische Fahrzeugdatensätze. Intervallangaben zählen belegte Aufgaben innerhalb der Profile.</p><p class="notice"><b>Ausbauziel: 1.000 belegte Fahrzeug-/Motorgruppen.</b><br>Aktueller Stand: ${scopes === null ? 'noch nicht ermittelt' : esc(numberLabel(scopes)) + ' Fahrzeug-/Motorgruppen'}.${scopes === null || scopes < 1000 ? ' Das Ziel ist noch offen.' : ''}</p><p class="small muted">Mehrere Aufgaben, Jahresangaben oder Quellen desselben Fahrzeug-/Motorbereichs erhöhen diesen Stand nicht.</p><p class="notice"><b>Abdeckung: Deutschland und Europa.</b> Markt, genaue Motorversion, Produktionsstand und Einsatzbedingungen müssen zum Fahrzeug passen.</p><p class="small muted">Viele Profile belegen einzelne Wartungsarbeiten. Die Anzahl ist kein Nachweis vollständiger Wartungspläne oder einer flächendeckenden deutschen HSN/TSN-Abdeckung. Fehlende Fristen bleiben offen. Vorschläge lassen sich gezielt übernehmen; bestehende Termine bleiben unverändert.</p></div><section class="panel"><h2>Meine Fahrzeuge</h2>${app.vehicles.map(v => { const primary = profileSummary(resultFor(v)); return `<button class="fw21-vehicle-link" data-vehicle="${esc(v.id)}"><span><b>${esc(vehicleName(v))}</b><small>${esc(primary.reason)}</small></span><span class="pill ${primary.status === 'exact' ? '' : 'warn'}">${esc(primary.label)}</span></button>`; }).join('') || '<p class="muted">Sobald du ein Fahrzeug anlegst, wird seine Zuordnung automatisch geprüft.</p>'}</section><section class="panel"><h2>Wartungsprofile & Fahrzeugdaten suchen</h2><form id="fw21-catalog-search" class="fw21-search-form"><label for="fw21-catalog-query">Modell, Motor, Einsatzbedingungen, Markt oder HSN/TSN<input id="fw21-catalog-query" class="search" value="${esc(catalogState.query)}" placeholder="Zum Beispiel Twingo, PureTech oder erschwert" maxlength="150"></label><label for="fw21-catalog-brand">Hersteller<select id="fw21-catalog-brand"><option value="">Alle Hersteller</option>${brands.map(b => `<option value="${esc(b)}" ${catalogState.brand === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label><button class="btn secondary" type="submit">Suchen</button></form><p class="small muted">Marke und Suchtext filtern beide Listen. Dokumentausgabe und Bauzeitraum werden getrennt ausgewiesen.</p></section><section class="fw21-profile-list" id="fw21-profiles"><h2>Wartungsprofile mit Quellen</h2><p class="small muted">${Number(profileResult.total).toLocaleString('de-DE')} passende Profile. Vor Arbeiten den fahrzeugbezogenen Herstellerplan und die Serviceanzeige abgleichen.</p>${pageControls(profileResult, profileState, 'data-fw21-profile-page', 'Wartungsprofile')}${profileResult.items.map(intervalCard).join('') || '<div class="empty">Kein passendes Wartungsprofil für diesen Filter gefunden. Fehlende Intervalle werden nicht geschätzt.</div>'}${pageControls(profileResult, profileState, 'data-fw21-profile-page', 'Wartungsprofile')}</section><section id="fw21-variants"><h2>Technische Fahrzeugdatensätze (ergänzend)</h2><p class="small muted">${Number(result.total).toLocaleString('de-DE')} passende Datensätze</p>${result.items.map(variantCard).join('') || '<div class="empty">Für diesen Filter ist kein technischer Fahrzeugdatensatz hinterlegt.</div>'}${pageControls(result, catalogState, 'data-fw21-page', 'Fahrzeugkatalog')}</section>`;
  }

  const oldRender = render;
  render = function () {
    if (['equipment21', 'ideas21', 'intervals21'].includes(app.page) && !app.selected) {
      inner(chrome(app.page === 'intervals21' ? intervalPage() : listPage(app.page)));
      return;
    }
    oldRender();
  };

  function navigate(page) {
    app.page = page;
    app.selected = null;
    app.msg = '';
    render();
    scrollTo(0, 0);
  }

  const oldBind21 = bind;
  bind = function () {
    oldBind21();
    document.querySelectorAll('[data-fw21-nav]').forEach(e => e.onclick = () => navigate(e.dataset.fw21Nav));
    document.querySelectorAll('[data-fw21-new]').forEach(e => e.onclick = () => edit21(e.dataset.fw21New));
    document.querySelectorAll('[data-fw21-edit]').forEach(e => e.onclick = () => { const [kind, id] = e.dataset.fw21Edit.split(':'); edit21(kind, id); });
    document.querySelectorAll('[data-fw21-del]').forEach(e => e.onclick = async () => {
      const [kind, id] = e.dataset.fw21Del.split(':');
      e.disabled = true;
      try { await remove21(kind, id); } catch (err) { setMessage(err.message, true); } finally { if (e.isConnected) e.disabled = false; }
    });
    if ($('fw21-catalog-search')) $('fw21-catalog-search').onsubmit = e => {
      e.preventDefault();
      catalogState.query = $('fw21-catalog-query').value.trim();
      catalogState.brand = $('fw21-catalog-brand').value;
      catalogState.offset = 0;
      profileState.offset = 0;
      render();
    };
    document.querySelectorAll('[data-fw21-page]').forEach(e => e.onclick = () => {
      if (e.disabled) return;
      catalogState.offset = Math.max(0, catalogState.offset + (e.dataset.fw21Page === 'next' ? 1 : -1) * catalogState.limit);
      render();
      $('fw21-variants')?.scrollIntoView({ block: 'start' });
    });
    document.querySelectorAll('[data-fw21-profile-page]').forEach(e => e.onclick = () => {
      if (e.disabled) return;
      profileState.offset = Math.max(0, profileState.offset + (e.dataset.fw21ProfilePage === 'next' ? 1 : -1) * profileState.limit);
      render();
      $('fw21-profiles')?.scrollIntoView({ block: 'start' });
    });
  };

  function edit21(kind, id = null) {
    if (!['equipment', 'ideas'].includes(kind) || !mobileDoc) return;
    const record = id ? mobileDoc.records[M.key(kind, id)] : null;
    if (id && (!record || record.deleted)) { setMessage('Dieser Eintrag ist nicht mehr vorhanden.', true); return; }
    const item = record?.data || {};
    let form = '';
    if (kind === 'ideas') {
      form = field('Titel', 'title', item.title, 'text', [], true) + field('Beschreibung', 'description', item.description, 'textarea') + field('Status', 'status', item.status || 'Neu', 'select', statuses);
    } else {
      form = field('Bezeichnung', 'name', item.name, 'text', [], true) + field('Kategorie', 'category', item.category || 'Werkzeug', 'select', categories) + field('Kaufdatum', 'purchased_at', item.purchased_at, 'date') + field('Kaufpreis in Euro', 'amount_eur', ((item.amount_cents || 0) / 100).toFixed(2).replace('.', ','), 'text', [], true) + field('Notizen', 'notes', item.notes, 'textarea');
    }
    mobileEditing = true;
    app.editing = true;
    inner(chrome(`<section class="panel"><h1>${kind === 'ideas' ? 'Idee' : 'Ausrüstung'} ${id ? 'bearbeiten' : 'hinzufügen'}</h1><form class="editor-v2" id="fw21-mobile-form">${form}<p id="fw21-error" class="status bad" role="alert" hidden></p><div class="actions"><button class="btn" type="submit">Speichern</button><button class="btn secondary" type="button" id="fw21-cancel">Abbrechen</button></div></form></section>`));
    const editor = $('fw21-mobile-form');
    const original = M.stable(Object.fromEntries(new FormData(editor)));
    const title = editor.querySelector('[name="title"],[name="name"]');
    if (title) title.maxLength = 250;
    if ($('edit-amount_eur')) { $('edit-amount_eur').inputMode = 'decimal'; $('edit-amount_eur').maxLength = 14; }
    $('fw21-cancel').onclick = () => {
      if (mobileSaving) return;
      if (original !== M.stable(Object.fromEntries(new FormData(editor))) && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
      mobileEditing = false;
      app.editing = false;
      render();
      window.fwCloud?.schedule(500);
    };
    editor.onsubmit = async e => {
      e.preventDefault();
      if (mobileSaving) return;
      mobileSaving = true;
      const button = e.target.querySelector('[type=submit]');
      button.disabled = true;
      try {
        const values = Object.fromEntries(new FormData(e.target));
        const doc = M.clone(mobileDoc), data = M.defaults(kind, { ...item });
        for (const [key, value] of Object.entries(values)) {
          if (key !== 'amount_eur' && Object.prototype.hasOwnProperty.call(data, key)) data[key] = String(value).trim();
        }
        if (!(kind === 'ideas' ? data.title : data.name)) throw Error(kind === 'ideas' ? 'Bitte einen Titel eingeben.' : 'Bitte eine Bezeichnung eingeben.');
        if (kind === 'equipment') {
          const amount = values.amount_eur.trim();
          if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount)) throw Error('Betrag zum Beispiel als 49,90 eingeben.');
          data.amount_cents = Math.round(Number(amount.replace(',', '.')) * 100);
        }
        data.updated_at = new Date().toISOString();
        const uid = id || crypto.randomUUID();
        doc.records[M.key(kind, uid)] = { entity: kind, uid, deleted: false, data };
        await commitLocal(doc);
        mobileEditing = false;
        app.editing = false;
        app.page = kind === 'ideas' ? 'ideas21' : 'equipment21';
        setMessage('Gespeichert. ' + (window.fwCloud?.config?.enabled ? 'Automatischer Abgleich folgt.' : 'Bisher auf diesem Gerät gespeichert; Cloud noch nicht aktiv.'));
      } catch (err) {
        $('fw21-error').hidden = false;
        $('fw21-error').textContent = err.message;
      } finally {
        mobileSaving = false;
        if (button.isConnected) button.disabled = false;
      }
    };
  }

  async function remove21(kind, id) {
    if (mobileSaving || mobileEditing || !['equipment', 'ideas'].includes(kind)) return;
    const record = mobileDoc.records[M.key(kind, id)];
    if (!record || record.deleted || !confirm(`„${record.data.title || record.data.name}“ wirklich löschen?`)) return;
    const doc = M.clone(mobileDoc);
    doc.records[M.key(kind, id)] = { entity: kind, uid: id, deleted: true, data: null };
    await commitLocal(doc);
    setMessage('Eintrag gelöscht. ' + (window.fwCloud?.config?.enabled ? 'Die Änderung wird synchronisiert.' : 'Die Änderung ist lokal gespeichert.'));
  }
})();
