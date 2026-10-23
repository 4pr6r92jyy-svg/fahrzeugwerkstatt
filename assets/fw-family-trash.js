/* Meine Fahrzeugwerkstatt 2.3.3 – NUR Papierkorb für Familienmeldungen.
 * Zusatzmodul: verändert keine vorhandene Familien-, Foto- oder Cloud-Funktion.
 * Ruft nur die neue, serverseitig besitzergeschützte READ-ONLY RPC auf.
 */
(function(root){'use strict';
  const admin=root.FWFamilyAdmin;
  if(!admin || typeof admin.render!=='function') {
    console.warn('Familien-Papierkorb: Familienverwaltung noch nicht geladen.');
    return;
  }
  const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ARCHIVED=new Set(['Gelöscht','Zurückgezogen']);
  const labels={mangel:'Mangel',wartung:'Wartung',hu:'HU / AU',km:'Kilometerstand'};
  let opened=false,query='',kind='',items=[],cursorAt=null,cursorId=null,hasMore=false;
  let loaded=false,busy=false,error='',requestNumber=0,typingTimer=null;
  function online(){return !!root.fwCloud?.transport?.session?.access_token;}
  function formatDate(value){
    if(!value)return '–';
    const date=new Date(value);
    return Number.isFinite(date.valueOf())?date.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'–';
  }
  function entryHTML(e){
    const details=[];
    if(e.reported_km!==null&&e.reported_km!==undefined&&e.reported_km!=='')details.push('km bei Meldung: '+e.reported_km);
    else if(e.km!==null&&e.km!==undefined&&e.km!=='')details.push('Kilometerstand: '+e.km);
    if(e.date)details.push('Angegebenes Datum: '+e.date);
    if(e.next)details.push('Nächste HU: '+e.next);
    return `<article class="fw-trash-item">
      <div class="fw-trash-item-heading"><strong>${E(e.vehicle_label||'Unbekanntes Fahrzeug')} · ${E(labels[e.kind]||e.kind)}</strong><span class="fw-trash-status">${E(e.status)}</span></div>
      <p class="fw-trash-description">${E(e.text||(e.kind==='km'?'Kilometerstand gemeldet':'Keine zusätzliche Beschreibung'))}</p>
      <p class="fam-small">Gemeldet von: ${E(e.reporter||'unbekannt')} · Eingang: ${E(formatDate(e.created_at))}</p>
      ${details.length?`<p class="fam-small">${E(details.join(' · '))}</p>`:''}
      <p class="fam-small">Zuletzt geändert: ${E(formatDate(e.updated_at))}</p>
    </article>`;
  }
  function resultHTML(){
    if(!loaded&&!busy)return '<p class="fam-small">Papierkorb öffnen, um frühere Meldungen zu laden.</p>';
    return `${error?`<p class="fam-notice fam-error" role="alert">${E(error)}</p>`:''}
      ${items.length?items.map(entryHTML).join(''):
        busy?'<p class="fam-small">Meldungen werden gesucht …</p>':
        '<p class="fam-small">Keine passenden Meldungen im Papierkorb gefunden.</p>'}
      ${busy&&items.length?'<p class="fam-small">Weitere Treffer werden geladen …</p>':''}
      ${!busy&&hasMore?'<button type="button" class="fam-btn secondary" data-fw-trash-more>Weitere Meldungen anzeigen</button>':''}`;
  }
  function panelHTML(){
    return `<section class="fam-panel fw-trash-panel" id="fw-trash-panel" aria-label="Papierkorb der Familienmeldungen">
      <div class="fw-trash-head"><div><h2>🗑️ 5. Papierkorb</h2><p class="fam-small">Gelöschte und zurückgezogene Familienmeldungen für die spätere Fehlersuche. Nur in deiner privaten Werkstatt.</p></div>
        <button type="button" class="fam-btn secondary" data-fw-trash-toggle aria-expanded="${opened?'true':'false'}">${opened?'Papierkorb schließen':'Papierkorb öffnen'}</button></div>
      ${opened?`<div class="fw-trash-body"><div class="fw-trash-controls">
        <label>Frühere Meldungen durchsuchen<input id="fw-trash-search" type="search" inputmode="search" maxlength="120" autocomplete="off" placeholder="z. B. quietscht beim Bremsen, Kuga, Reifen" value="${E(query)}"></label>
        <label>Meldungsart<select id="fw-trash-kind"><option value="">Alle Arten</option>${Object.entries(labels).map(([id,title])=>`<option value="${id}" ${kind===id?'selected':''}>${title}</option>`).join('')}</select></label>
        <button type="button" class="fam-btn secondary" data-fw-trash-reload>↻ Suchen / Aktualisieren</button>
      </div><div id="fw-trash-results" aria-live="polite">${resultHTML()}</div>
      <p class="fam-small fw-trash-tip">„Zurückgezogen“ bedeutet: Das Familienmitglied hat die Meldung entfernt. Ob der Fehler von allein verschwunden ist, lässt sich daraus nicht sicher ableiten. Keine endgültige Löschung und keine Wiederherstellung aus diesem Papierkorb.</p></div>`:''}
    </section>`;
  }
  function refreshResults(){const e=document.getElementById('fw-trash-results');if(e)e.innerHTML=resultHTML();}
  function refreshPanel(){const e=document.getElementById('fw-trash-panel');if(e)e.outerHTML=panelHTML();}
  async function search(restart=true){
    if(!opened||busy&&!restart)return;
    const request=++requestNumber;
    if(restart){items=[];cursorAt=null;cursorId=null;hasMore=false;}
    busy=true;error='';refreshResults();
    try{
      const transport=root.fwCloud?.transport;
      if(!transport?.session?.access_token)throw Error('Bitte zuerst mit deinem privaten Werkstattzugang anmelden.');
      const result=await transport.json('/rest/v1/rpc/fw_family_trash_search',{
        p_query:query,p_kind:kind,p_before_at:cursorAt,p_before_id:cursorId,p_limit:30
      });
      if(request!==requestNumber)return;
      if(!result||!Array.isArray(result.events))throw Error('Papierkorb-Antwort ist ungültig.');
      // Auf der Client-Seite nur für die Anzeige; Server entscheidet über die Berechtigungen.
      const found=result.events.filter(e=>ARCHIVED.has(e.status));
      items=restart?found:items.concat(found);
      hasMore=result.has_more===true;
      cursorAt=hasMore?result.next_before_at:null;
      cursorId=hasMore?result.next_before_id:null;
      loaded=true;
    }catch(e){if(request===requestNumber)error=e?.message||'Suche fehlgeschlagen.';}
    finally{if(request===requestNumber){busy=false;loaded=true;refreshResults();}}
  }
  function resetSearch(){
    clearTimeout(typingTimer);++requestNumber;busy=false;loaded=false;
    items=[];hasMore=false;cursorAt=null;cursorId=null;error='';
    refreshResults();search(true).catch(()=>{});
  }
  const originalRender=admin.render;
  admin.render=function(...args){
    let html=originalRender.apply(this,args);
    if(typeof html!=='string')return html;
    // Nur Besitzer-Übersicht: archivierte Einträge nicht nochmals als aktive Meldungen zeigen.
    // Genau definierte Artikelform stammt aus family-admin.js 2.3.3.
    html=html.replace(/<article class="fam-message">[\s\S]*?<\/article>/g,part=>
      /<span class="fam-pill">(?:Gelöscht|Zurückgezogen)<\/span>/.test(part)?'':part);
    if(!online())return html;
    const tail=html.lastIndexOf('</section>');
    return tail<0?html+panelHTML():html.slice(0,tail)+panelHTML()+html.slice(tail);
  };
  // Die Fahrzeug-Kurzansicht zeigt keine Papierkorbmeldungen mehr als aktive Hinweise.
  if(typeof admin.vehicleCard==='function'){
    const oldCard=admin.vehicleCard;
    admin.vehicleCard=function(...args){
      let html=oldCard.apply(this,args);
      if(typeof html!=='string'||!/(?:Gelöscht|Zurückgezogen)/.test(html))return html;
      html=html.replace(/<p>[\s\S]*?<\/p>/g,part=>
        /<small> · (?:Gelöscht|Zurückgezogen)<\/small>/.test(part)?'':part);
      const count=(html.match(/<p>/g)||[]).length;
      return html.replace(/<h3>📣 Familienmeldungen(?: \(\d+\))?<\/h3>/,
        `<h3>📣 Familienmeldungen${count?' ('+count+')':''}</h3>`);
    };
  }
  document.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-fw-trash-toggle],[data-fw-trash-reload],[data-fw-trash-more]');
    if(!trigger)return;
    event.preventDefault();
    if(trigger.matches('[data-fw-trash-toggle]')){
      opened=!opened;refreshPanel();
      if(opened)resetSearch();
    }else if(trigger.matches('[data-fw-trash-reload]'))resetSearch();
    else if(trigger.matches('[data-fw-trash-more]'))search(false).catch(()=>{});
  });
  document.addEventListener('input',event=>{
    if(event.target.id!=='fw-trash-search')return;
    query=event.target.value.slice(0,120);
    clearTimeout(typingTimer);
    typingTimer=setTimeout(resetSearch,350);
  });
  document.addEventListener('change',event=>{
    if(event.target.id!=='fw-trash-kind')return;
    kind=event.target.value;resetSearch();
  });
  root.FWFamilyTrash={reload:resetSearch};
})(window);
