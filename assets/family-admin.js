/* Gemeinsame Besitzer-Ansicht: nur der eingeloggte private Werkstatt-Benutzer.
   Familienkontakte erhalten weder dieses Login noch einen direkten Tabellenzugriff. */
(function(root){'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let snapshot=null,loading=false,message='',isError=false,initialized=false;
function config(){try{return JSON.parse(localStorage.getItem('fwcloud.config.v1')||'null')}catch{return null}}
function transport(){const t=root.fwCloud?.transport;if(!t?.session?.access_token)throw Error('Zuerst unter „Abgleich & Geräte“ mit deinem Werkstattzugang anmelden.');return t}
async function rpc(fn,body={}){const t=transport();return t.json('/rest/v1/rpc/'+fn,body)}

// Familien-Titelbilder: eigenes, auf <= 640 px verkleinertes JPEG, niemals der private Originalanhang.
const coverMarker='[[FW_COVER_V1]]';
async function coverBlob(v){
 if(typeof DATA!=='undefined' && Array.isArray(DATA.attachments)){
  const local=DATA.vehicles?.find(x=>String(x.family_uid||x.id)===String(v.id));
  if(!local)return null;
  const a=DATA.attachments.filter(a=>String(a.vehicle_id)===String(local.id)&&String(a.media_type||'').startsWith('image/')&&String(a.notes||'').startsWith(coverMarker)).sort((a,b)=>Number(b.id)-Number(a.id))[0];
  if(!a)return null;
  const r=await fetch('/api/attachments/'+a.id+'/file');if(!r.ok)throw Error('Titelbild auf Windows nicht lesbar');
  return {blob:await r.blob(), source:String(a.stored_name||a.id)};
 }
 if(typeof rows==='function' && typeof kvGet==='function'){
  const a=rows('attachments').filter(a=>String(a.vehicle_id)===String(v.id)&&String(a.media_type||'').startsWith('image/')&&String(a.notes||'').startsWith(coverMarker)).sort((a,b)=>String(b.id).localeCompare(String(a.id)))[0];
  if(!a)return null;
  const blob=await kvGet('files',a.stored_name);
  if(!blob)throw Error('Titelbild auf diesem Gerät noch nicht offline vorhanden');
  return {blob,source:String(a.stored_name)};
 }
 return null;
}
async function compactCover(blob){
 const bitmap=await createImageBitmap(blob),max=640,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(bitmap.width*scale));cv.height=Math.max(1,Math.round(bitmap.height*scale));
 const cx=cv.getContext('2d');cx.fillStyle='#f4f4f4';cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(bitmap,0,0,cv.width,cv.height);bitmap.close?.();
 for(const quality of [.75,.58,.4]){const val=cv.toDataURL('image/jpeg',quality);if(val.length<=155000)return val;}
 throw Error('Fahrzeugbild konnte nicht unter 115 KB komprimiert werden');
}
let coverSync=false;
async function syncFamilyCovers(){
 if(coverSync||!snapshot?.vehicles||!root.fwCloud?.transport?.session)return;
 coverSync=true;try{
  for(const v of snapshot.vehicles.filter(v=>v.published)){
   const actual=await coverBlob(v);
   const source=actual?.source||null;
   if((v.cover_source||null)===source)continue;
   await rpc('fw_family_admin_cover',{p_vehicle_id:v.id,p_image:actual?await compactCover(actual.blob):null,p_source:source});
   v.cover_source=source;
  }
 }catch(err){console.warn('Familien-Titelbildabgleich:',err.message)}finally{coverSync=false}
}

function updateBadge(){const pending=(snapshot?.events||[]).filter(e=>e.status==='Neu'||e.status==='Wartet auf Freigabe').length;const b=document.getElementById('familyCount');if(b){b.hidden=!pending;b.textContent=pending||''}}
function vehicleCard(uid){if(!uid)return '';const e=(snapshot?.events||[]).filter(x=>x.vehicle_id===uid);return `<section class="card fam-vehicle-card"><div class="sectiontitle"><h3>📣 Familienmeldungen${e.length?' ('+e.length+')':''}</h3><button class="outline mini" data-page="family">Meldungen öffnen →</button></div>${e.length?e.slice(0,4).map(x=>`<p><strong>${E(({mangel:'Mangel',wartung:'Wartung',hu:'HU/AU',km:'Kilometerstand'}[x.kind]||x.kind))}</strong>: ${E(x.payload?.text||((x.payload?.km??'')+' km'))} <small>· ${E(x.status)}</small></p>`).join(''):'<p class="slim">Keine neuen Familienmeldungen bekannt. Öffne „Familienmeldungen“, um den aktuellen Stand zu laden.</p>'}</section>`}
function redraw(){if(typeof ui!=='undefined'&&ui.page==='family'&&typeof render==='function')render();else if(typeof app!=='undefined'&&app.page==='family'&&typeof render==='function')render();}
function notify(text,error=false){message=text;isError=error;redraw()}
async function load(){if(loading)return;loading=true;redraw();try{snapshot=await rpc('fw_family_admin_state');message='';isError=false;}catch(e){snapshot=null;message=e.message;isError=true;}finally{loading=false;updateBadge();redraw()}if(snapshot)syncFamilyCovers().catch(()=>{})}
const msg=()=>message?`<p class="fam-notice ${isError?'fam-error':'fam-success'}" role="status">${E(message)}</p>`:'';
function renderPanel(){const conf=config(),online=!!root.fwCloud?.transport?.session;
 const url=localStorage.getItem('fwfamily.public_url')||((location.protocol==='https:'&&location.pathname.includes('/'))?new URL('familie/',location.href).href:'');
 return `<section class="fam-admin">
 <div class="fam-head"><div><div class="eyebrow">MEINE FAHRZEUGWERKSTATT</div><h1>📣 Was klappert denn da?</h1><p>Freigaben und Meldungen deiner Familienseite. Die privaten Werkstattdaten bleiben geschützt.</p></div><button class="fam-btn" data-family-action="reload">↻ Aktualisieren</button></div>
 ${msg()}
 ${!online?`<div class="fam-panel"><h2>Zuerst Cloudverbindung aktivieren</h2><p>Bitte im Bereich „Abgleich & Geräte“ anmelden und den Datenstand vollständig synchronisieren. Die Familienseite verwendet dieselbe Supabase-Cloud, aber nicht dein Benutzerkonto.</p></div>`:
 !snapshot?`<div class="fam-panel">${loading?'Lade Familienmeldungen …':'Die Familien-SQL ist eventuell noch nicht eingerichtet. Siehe Anleitung FAMILIENPORTAL_START.html.'}</div>`:
 `<div class="fam-panel"><h2>1. Familienzugang</h2><p>${snapshot.enabled?'🟢 Familienseite freigegeben':'⚪ Familienseite deaktiviert'}. Der Code wird ausschließlich in Supabase geprüft und nicht in GitHub gespeichert.</p>
 <form data-family-form="code" class="fam-form"><label>Familiencode ${snapshot.pin_configured?'ändern':'einrichten'}<input name="pin" type="password" required minlength="4" maxlength="72" autocomplete="new-password" placeholder="Gemeinsamen Code eingeben"></label><button class="fam-btn" type="submit">Code speichern und Zugang einschalten</button></form>
 ${snapshot.pin_configured?`<button class="fam-btn secondary" data-family-action="toggle">${snapshot.enabled?'Familienzugang sperren':'Familienzugang wieder einschalten'}</button>`:''}
 <p class="fam-small">Ein kurzer gemeinsamer Code ist einfach, aber kein starker Schutz. Gib den Link nicht öffentlich weiter. Auf Geräten wird nur eine zeitlich begrenzte Sitzung gespeichert.</p></div>
 <details class="fam-panel" id="fam-vehicle-release"><summary style="cursor:pointer;font-weight:700;font-size:1.2em">2. Fahrzeuge freigeben <small style="font-weight:400">(zum Öffnen anklicken)</small></summary><p>Nur ausgewählte Fahrzeuge mit Anzeigename und Kilometerstand sowie offene Wartungstitel und Fälligkeiten werden sichtbar. Keine FIN, Kennzeichen, Kosten oder internen Notizen.</p>
 <form data-family-form="vehicles" class="fam-form"><div class="fam-car-list">${(snapshot.vehicles||[]).map(v=>`<label class="fam-car"><input type="checkbox" name="vehicle" value="${E(v.id)}" ${v.published?'checked':''}><span><strong>${E(v.label)}</strong><small> ${v.mileage??'–'} km · öffentliche Bezeichnung:</small><input type="text" data-family-label="${E(v.id)}" maxlength="140" value="${E(v.public_label||v.label)}" aria-label="Anzeigename für ${E(v.label)}"></span></label>`).join('')||'<p>Kein Cloudfahrzeug vorhanden. Zuerst den normalen Cloudabgleich abschließen.</p>'}</div><button class="fam-btn" type="submit">Fahrzeugauswahl speichern</button></form></details>
 <div class="fam-panel"><h2>3. Familienseite veröffentlichen</h2><p>Kopiere den Ordner <code>familie</code> in den bisherigen GitHub-Pages-Upload und die heruntergeladene <code>config.json</code> in denselben Ordner. Die Konfigurationsdatei enthält NUR den öffentlichen Projekt-Schlüssel und die Freigabe-ID.</p>
 <button class="fam-btn" data-family-action="config">Konfigurationsdatei herunterladen</button>
 <label class="fam-label">Öffentliche URL der Familienseite<input type="url" data-family-url value="${E(url)}" placeholder="https://benutzer.github.io/repo/familie/"></label>
 <button class="fam-btn secondary" data-family-action="copylink">Link mit Freigabe-ID kopieren</button>
 <p class="fam-small">Den Link erst verteilen, wenn SQL eingerichtet und der Ordner online ist.</p></div>
 <div class="fam-panel"><h2>4. Meldungen prüfen (${(snapshot.events||[]).filter(e=>e.status==='Neu'||e.status==='Wartet auf Freigabe').length} neu)</h2>
 ${snapshot.events?.length?snapshot.events.map(e=>{const v=snapshot.vehicles.find(v=>v.id===e.vehicle_id);const title={km:'Kilometerstand',hu:'HU / AU',wartung:'Wartung',mangel:'Mangel'}[e.kind]||e.kind;return `<article class="fam-message"><div class="fam-message-top"><strong>${E(title)} · ${E(v?.public_label||v?.label||'Fahrzeug')}</strong><span class="fam-pill">${E(e.status)}</span></div><p>${E(e.payload?.text||(e.kind==='km'?`${e.payload?.km} km`:'—'))}</p>${Array.isArray(e.payload?.photos)?`<div class="fam-photo-row">${e.payload.photos.slice(0,3).map((src,i)=>typeof src==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(src)?`<button type="button" data-family-photo="${E(src)}" aria-label="Foto ${i+1} groß anzeigen"><img src="${E(src)}" alt="Foto zur Meldung" loading="lazy"></button>`:'').join('')}</div>`:''}${Array.isArray(e.payload?.replies)?e.payload.replies.slice(0,30).map(r=>`<div class="fam-reply"><b>Werkstattantwort · ${E(new Date(r.at).toLocaleString('de-DE'))}</b><p>${E(r.text)}</p></div>`).join(''):''}${e.kind==='mangel'&&e.status!=='Gelöscht'&&e.status!=='Zurückgezogen'?`<form data-family-form="reply" data-event-id="${E(e.id)}" class="fam-form"><label>Antwort für die Familie<textarea name="reply" maxlength="1000" rows="2" required placeholder="Zum Beispiel: Ich schaue am Wochenende nach."></textarea></label><button class="fam-btn" type="submit">Antwort senden</button></form>`:''}${e.payload?.date?`<p class="fam-small">Datum: ${E(e.payload.date)}${e.payload.km?' · '+E(e.payload.km)+' km':''}${e.payload.next?' · nächste HU: '+E(e.payload.next):''}</p>`:''}<p class="fam-small">Gemeldet von: ${E(e.payload?.reporter||'unbekannt')} · Eingang: ${E(new Date(e.created_at).toLocaleString('de-DE'))}</p><form data-family-form="eventkm" data-event-id="${E(e.id)}" class="fam-form"><label>km bei Meldung (von dir ergänzbar)<input type="number" min="0" max="2000000" name="km" value="${E(e.payload?.reported_km??'')}" placeholder="nicht erfasst"></label><button class="fam-btn secondary" type="submit">km zur Meldung speichern</button></form>
 <div class="fam-actions"><button class="fam-btn subtle" data-family-delete="${E(e.id)}">Meldung löschen</button>${e.status==='Neu'||e.status==='In Arbeit'||e.status==='Wartet auf Freigabe'?`${e.kind==='mangel'?`<button class="fam-btn" data-family-decision="diagnose" data-id="${E(e.id)}">Als Diagnose übernehmen</button><button class="fam-btn secondary" data-family-decision="in_arbeit" data-id="${E(e.id)}">In Arbeit</button><button class="fam-btn secondary" data-family-decision="erledigt" data-id="${E(e.id)}">Erledigt</button>`:e.kind==='hu'||e.kind==='wartung'?`<button class="fam-btn" data-family-decision="freigeben" data-id="${E(e.id)}">Prüfen & übernehmen</button>`:''}<button class="fam-btn subtle" data-family-decision="ablehnen" data-id="${E(e.id)}">Ablehnen</button>`:''}</div></article>`}).join(''):'<p>Noch keine Meldungen.</p>'}</div>`}
 </section>`}
function downloadFile(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function shareLink(){if(!snapshot?.share_id)throw Error('Zuerst Familiencode einrichten.');let url=document.querySelector('[data-family-url]')?.value.trim()||'';if(!/^https:\/\//.test(url))throw Error('Bitte zuerst die HTTPS-Adresse deiner Familienseite eintragen.');localStorage.setItem('fwfamily.public_url',url);const u=new URL(url);u.searchParams.set('projekt',snapshot.share_id);return u.toString()}
async function action(fn){const c=config();if(fn==='reload'){await load();return}
 if(fn==='config'){if(!snapshot?.share_id||!c?.key||!c?.url)throw Error('Cloudverbindung und Familiencode fehlen.');downloadFile('config.json',{url:c.url,key:c.key,share_id:snapshot.share_id});notify('config.json gespeichert. Diese Datei zusammen mit dem Ordner „familie“ veröffentlichen.');return}
 if(fn==='copylink'){const value=shareLink();try{await navigator.clipboard.writeText(value);notify('Familienlink kopiert.')}catch{notify('Bitte Familienlink kopieren: '+value)}return}
 if(fn==='toggle'){if(!confirm(snapshot.enabled?'Familienzugang jetzt sperren? Bereits angemeldete Geräte werden abgemeldet.':'Familienzugang wieder einschalten?'))return;await rpc('fw_family_admin_config',{p_pin:null,p_enabled:!snapshot.enabled});await load();return}}
document.addEventListener('submit',async ev=>{const f=ev.target.closest('[data-family-form]');if(!f)return;ev.preventDefault();const button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;try{if(f.dataset.familyForm==='code'){const pin=String(new FormData(f).get('pin')||'');if(!confirm('Familienzugang mit diesem Code aktivieren? Bereits angemeldete Familiengeräte müssen den neuen Code nach einer Änderung erneut eingeben.'))return;await rpc('fw_family_admin_config',{p_pin:pin,p_enabled:true})}
 else if(f.dataset.familyForm==='reply'){const reply=String(new FormData(f).get('reply')||'').trim();if(!reply||reply.length>1000)throw Error('Bitte eine Antwort mit 1 bis 1000 Zeichen schreiben.');await rpc('fw_family_admin_reply',{p_event_id:f.dataset.eventId,p_text:reply});await load();notify('Antwort für die Familie gespeichert.');return}
 else if(f.dataset.familyForm==='eventkm'){const km=String(new FormData(f).get('km')||'').trim();await rpc('fw_family_admin_event',{p_event_id:f.dataset.eventId,p_action:'km',p_value:km});await load();notify('Kilometerstand zur Meldung gespeichert.');return}
 else if(f.dataset.familyForm==='vehicles'){const items=[...f.querySelectorAll('input[name="vehicle"]:checked')].map(input=>({id:input.value,label:f.querySelector('[data-family-label="'+input.value+'"]')?.value.trim()||''}));if(items.length===0&&!confirm('Alle Fahrzeugfreigaben entfernen?'))return;await rpc('fw_family_admin_publish',{p_items:items})}await load();notify('Einstellungen gespeichert.');}catch(e){notify(e.message,true)}finally{if(button?.isConnected)button.disabled=false}});
document.addEventListener('click',async ev=>{const imageBtn=ev.target.closest('[data-family-photo]');if(imageBtn){ev.preventDefault();const dlg=document.createElement('dialog');dlg.className='fam-picture-preview';const image=document.createElement('img');image.src=imageBtn.dataset.familyPhoto;image.alt='Foto aus Familienmeldung';const close=document.createElement('button');close.textContent='Schließen';close.type='button';close.addEventListener('click',()=>dlg.close());dlg.append(close,image);document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.showModal();return}const target=ev.target.closest('[data-family-action],[data-family-decision],[data-family-delete]');if(!target)return;ev.preventDefault();if(target.disabled)return;target.disabled=true;try{if(target.dataset.familyDelete){if(!confirm('Meldung aus der Familienübersicht entfernen? Schon übernommene Wartungen oder Diagnosen werden dadurch NICHT gelöscht.'))return;await rpc('fw_family_admin_event',{p_event_id:target.dataset.familyDelete,p_action:'delete',p_value:''});await load();notify('Meldung entfernt.');return}if(target.dataset.familyDecision){const op=target.dataset.familyDecision;if(['freigeben','diagnose'].includes(op)&&!confirm(op==='freigeben'?'Diese Wartung/HU als erledigten Eintrag in deine private Werkstatt übernehmen?':'Diesen Mangel als neuen Diagnosefall anlegen?'))return;await rpc('fw_family_admin_decide',{p_event_id:target.dataset.id,p_action:op});await load();notify('Meldung aktualisiert. Die Werkstatt gleicht die Änderungen beim nächsten Cloud-Abgleich ab.');root.fwCloud?.schedule?.(1000)}else await action(target.dataset.familyAction)}catch(e){notify(e.message,true)}finally{if(target.isConnected)target.disabled=false}});
root.FWFamilyAdmin={render:renderPanel,load,vehicleCard};
setInterval(()=>{if(document.visibilityState==='hidden'||!root.fwCloud?.transport?.session)return;if((typeof ui!=='undefined'&&ui.page==='family')||(typeof app!=='undefined'&&app.page==='family'))return;load().catch(()=>{});},60000);
})(window);
