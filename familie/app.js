/* Was klappert denn da? – eigenständige Familienseite.
   Kein Owner-Login, keine lokale Kopie der privaten Werkstatt. */
(function(){'use strict';
const root=document.getElementById('app'), E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cfg=null,token='',data=null,vehicle='',screen='home',busy=false,error='',notice='';
let repliesByEvent={}, galleryByVehicle={}, galleryError="", galleryBusy=false;
let ownerSearch="",ownerTrash=[];
// Separater Besitzerzugang: Familiencode bleibt ohne Adminrechte.
let ownerOpen=false,ownerToken='',ownerItems=[],ownerVehicles=[],ownerLoading=false,ownerError='',ownerNote='';
// Drei voneinander unabhängige Fotoslots für Mängelmeldungen.
const photoSlots=[null,null,null],photoPreviewUrls=[null,null,null];
function resetPhotoSlots(){for(let i=0;i<3;i++){if(photoPreviewUrls[i])URL.revokeObjectURL(photoPreviewUrls[i]);photoPreviewUrls[i]=null;photoSlots[i]=null;}}
function updatePhotoSlot(i){
 const item=document.querySelector(`[data-photo-slot="${i}"]`);if(!item)return;
 const preview=item.querySelector('.family-slot-image'),empty=item.querySelector('.family-slot-empty'),remove=item.querySelector('[data-photo-remove]');
 if(photoPreviewUrls[i]){preview.src=photoPreviewUrls[i];preview.hidden=false;empty.hidden=true;remove.hidden=false;}
 else{preview.removeAttribute('src');preview.hidden=true;empty.hidden=false;remove.hidden=true;}
}

function ownerPanel(){
 const search=ownerSearch.toLocaleLowerCase('de-DE');
 const matches=e=>[e.kind,e.status,e.payload?.text,e.text,e.payload?.reporter,e.reporter,e.vehicle_label,ownerVehicles.find(v=>String(v.id)===String(e.vehicle_id))?.label].some(x=>String(x||'').toLocaleLowerCase('de-DE').includes(search));
 const entries=ownerItems.filter(e=>!['Gelöscht','Zurückgezogen'].includes(e.status)&&matches(e)).slice(0,75);
 const trash=ownerTrash.filter(matches).slice(0,75);
 return `<details class="family-card family-owner" id="family-owner-panel" ${ownerOpen?'open':''}><summary>🔐 Nur für Werkstatt-Admin · Meldungen verwalten</summary>
 <p class="family-owner-intro">Dieser Bereich ist nur mit deinem persönlichen Supabase-Werkstattkonto erreichbar. Der Familiencode berechtigt nicht zum Löschen.</p>
 ${ownerError?`<p class="family-alert" role="alert">${E(ownerError)}</p>`:''}${ownerNote?`<p class="family-ok" role="status">${E(ownerNote)}</p>`:''}
 ${ownerToken?`<div class="family-flex"><b>Administrator angemeldet</b><button type="button" class="family-minibutton" data-owner-logout>Admin abmelden</button></div>
 <button type="button" class="family-minibutton" data-owner-refresh ${ownerLoading?'disabled':''}>↻ Adminmeldungen aktualisieren</button>
 <label>🔎 Meldungen durchsuchen<input id="family-owner-search" type="search" maxlength="120" value="${E(ownerSearch)}" placeholder="Fahrzeug, Name oder Fehler"></label>
 ${entries.length?entries.map(e=>`<div class="family-event family-owner-event"><div class="family-flex"><b>${E(({mangel:'Mangel',wartung:'Wartung',hu:'HU/AU',km:'Kilometerstand'}[e.kind]||e.kind))} · ${E(ownerVehicles.find(v=>String(v.id)===String(e.vehicle_id))?.public_label||ownerVehicles.find(v=>String(v.id)===String(e.vehicle_id))?.label||e.vehicle_label||'Fahrzeug')}</b><small>${E(e.status)}</small></div><p>${E(e.payload?.text||e.text||'Keine Beschreibung')}</p><small>Von ${E(e.payload?.reporter||e.reporter||'unbekannt')} · ${E(formatDate(e.created_at))}</small><button type="button" class="family-minibutton family-owner-delete" data-owner-delete="${E(e.id)}" ${ownerLoading?'disabled':''}>Meldung in Papierkorb verschieben</button></div>`).join(''):'<p>Keine passenden aktiven Meldungen.</p>'}
 <h3>🗑 Papierkorb</h3>${trash.length?trash.map(e=>`<div class="family-event family-owner-event"><b>${E(e.kind||'Meldung')} · ${E(e.vehicle_label||'Fahrzeug')}</b><p>${E(e.payload?.text||e.text||'')}</p><button type="button" class="family-minibutton" data-owner-restore="${E(e.id)}">Wiederherstellen</button> <button type="button" class="family-minibutton family-owner-delete" data-owner-permanent="${E(e.id)}">Endgültig löschen</button></div>`).join(''):'<p>Keine passenden Meldungen im Papierkorb.</p>'}`:
 `<form id="family-owner-login" autocomplete="on"><label>E-Mail des Werkstatt-Administrators<input type="email" name="email" autocomplete="username" required></label><label>Passwort des Werkstatt-Administrators<input type="password" name="password" autocomplete="current-password" required></label><button type="submit" class="family-button" ${ownerLoading?'disabled':''}>Als Admin anmelden</button></form><button type="button" class="family-minibutton family-owner-existing" data-owner-existing>Bestehende iPhone-Werkstatt-Anmeldung verwenden</button>`}
 </details>`;
}
async function ownerCall(fn,params={},authToken=ownerToken){
 if(!cfg||!authToken)throw Error('Bitte zuerst mit deinem persönlichen Werkstattkonto anmelden.');
 const res=await fetch(cfg.url+'/rest/v1/rpc/'+fn,{method:'POST',mode:'cors',headers:{apikey:cfg.key,Authorization:'Bearer '+authToken,'Content-Type':'application/json'},body:JSON.stringify(params),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
 const result=await res.json().catch(()=>({}));
 if(!res.ok||result?.error)throw Error(result?.message||result?.error||'Keine Adminberechtigung (HTTP '+res.status+').');
 return result;
}
async function ownerCheck(candidate){
 const verified=await ownerCall('fw_family_admin_only',{},candidate);
 if(verified!==true)throw Error('Dieses Konto ist nicht als alleiniger Werkstatt-Administrator berechtigt.');
 const state=await ownerCall('fw_family_admin_state',{},candidate);
 if(!state||!Array.isArray(state.events))throw Error('Supabase hat den Administratorzugang nicht bestätigt.');
 ownerToken=candidate;try{ownerTrash=await ownerCall('fw_family_admin_trash',{},candidate);}catch(_){ownerTrash=[];}ownerItems=state.events;ownerVehicles=state.vehicles||[];ownerError='';ownerNote='Administratorzugang geprüft.';ownerOpen=true;draw();
}
const STORAGE='fw-family.session.v1',NAMEKEY='fw-family.name.v2',OWNKEY='fw-family.ownership.v2';
function memberName(){return localStorage.getItem(NAMEKEY)||''}
function owned(){try{return JSON.parse(localStorage.getItem(OWNKEY)||'{}')}catch{return {}}}
function rememberOwned(id,secret){const a=owned();a[id]=secret;localStorage.setItem(OWNKEY,JSON.stringify(a))}
function makeSecret(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('')}

const img='<img class="family-banner" src="assets/panorama.png" width="2048" height="682" alt="Werkstattpanorama, unverändert" />';
function tokenKey(){return STORAGE+':'+(cfg?.share_id||'')}
async function call(fn,body){if(!cfg)throw Error('Familienseite ist noch nicht eingerichtet.');const response=await fetch(cfg.url+'/rest/v1/rpc/'+fn,{method:'POST',mode:'cors',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});let json;try{json=await response.json()}catch{throw Error('Ungültige Serverantwort. Bitte Internetverbindung prüfen.')}if(!response.ok||json?.error)throw Error(json?.error||json?.message||'Cloudfehler '+response.status);return json}
async function refresh(){if(!token){data=null;draw();return}try{data=await call('fw_family_read',{p_share_id:cfg.share_id,p_token:token});if(vehicle&&!data.vehicles.some(v=>v.id===vehicle))vehicle='';error='';try{const rows=await call('fw_family_responses',{p_share_id:cfg.share_id,p_token:token});repliesByEvent=Object.fromEntries((Array.isArray(rows)?rows:[]).map(x=>[x.id,Array.isArray(x.replies)?x.replies:[]]));}catch(_){repliesByEvent={};}draw()}catch(e){if(/Zugang|code|abgelaufen|ungültig/i.test(e.message)){localStorage.removeItem(tokenKey());token='';data=null;}error=e.message;draw()}}
async function galleryLoad(id){
 if(!id||!token)return;
 try{const rows=await call('fw_family_gallery_list',{p_share_id:cfg.share_id,p_token:token,p_vehicle_id:id});galleryByVehicle[id]=(Array.isArray(rows)?rows:[]).map(x=>({...x,mine:!!localStorage.getItem('fw-gallery-proof:'+x.id)}));galleryError='';}
 catch(e){galleryError='Fotogalerie noch nicht eingerichtet oder nicht erreichbar: '+e.message;galleryByVehicle[id]=[];}
 draw();
}
function galleryPanel(id){const pictures=galleryByVehicle[id]||[];
 return `<details class="family-card family-gallery" id="family-gallery"><summary>📷 Unsere Fahrzeugfotos (${pictures.length}/10)</summary>
 ${galleryError?`<p class="family-alert">${E(galleryError)}</p>`:''}
 <div class="family-gallery-grid">${pictures.map(x=>`<div class="family-gallery-item"><button type="button" class="family-picture-button" data-gallery-view="${E(x.id)}"><img src="${/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x.photo)?x.photo:''}" loading="lazy" alt="Fahrzeugfoto"></button><p>${E(x.caption||'Fahrzeugfoto')}</p>${x.mine?`<button type="button" class="family-minibutton" data-gallery-delete="${E(x.id)}">Eigenes Foto löschen</button>`:''}</div>`).join('')}</div>
 ${pictures.length<10?`<form id="family-gallery-upload"><label>Foto hinzufügen<input type="file" name="photo" accept="image/*" required></label><label>Beschreibung (optional)<input type="text" name="caption" maxlength="100" placeholder="z. B. neue Felgen"></label><button type="submit" class="family-button" ${galleryBusy?'disabled':''}>Foto speichern</button></form>`:'<p>Maximal 10 Fotos pro Fahrzeug erreicht.</p>'}
 </details>`;
}
function formatDate(dt){try{return new Date(dt).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return '–'}}
function draw(){const mine=(data?.vehicles||[]).find(x=>x.id===vehicle);
root.innerHTML=`<div class="family-wrap"><header class="family-header"><img src="assets/logo.png" alt="Unverändertes Werkstattlogo"/><span>Die kleine Werkstatt-Meldeseite</span></header>
${img}<button type="button" class="family-picture-button family-picture-first" data-picture="assets/familienwerkstatt.png" aria-label="Familienwerkstatt-Bild vergrößern"><img src="assets/familienwerkstatt.png" alt="Illustrierte Familienwerkstatt mit Familienfahrzeugen" loading="eager"></button><h1>Was klappert denn da?</h1><a class="bilderwelt-entry" href="bilderwelt.html" aria-label="Unsere Bilderwelt öffnen">📸 Unsere Bilderwelt <span aria-hidden="true">›</span></a><p class="family-intro">Auto auswählen, kurz eintragen – Björn kümmert sich.</p>
${error?`<div class="family-alert" role="alert">${E(error)}</div>`:''}${notice?`<div class="family-ok" role="status">${E(notice)}</div>`:''}
${!cfg?`<div class="family-card"><h2>Einrichtung fehlt</h2><p>Die Datei <code>config.json</code> muss erst aus der Hauptwerkstatt exportiert und hier bei GitHub Pages veröffentlicht werden.</p></div>`:
!data?`<div class="family-card"><h2>🔐 Hallo!</h2><p>Gib einmal den gemeinsamen Familiencode ein. Danach merkt sich dieses Gerät den Zugang für 60 Tage.</p><form id="family-login"><label>Familiencode<input type="password" name="pin" autocomplete="off" minlength="4" maxlength="72" required autofocus></label><button class="family-button" type="submit" ${busy?'disabled':''}>Weiter →</button></form></div>`:
`<section class="family-card"><label class="family-label">👤 Dein Name<input id="family-name" maxlength="80" placeholder="Vorname" value="${E(memberName())}"></label><label class="family-label">🚗 Mein Fahrzeug
 <select id="family-vehicle"><option value="">Bitte Fahrzeug auswählen</option>${data.vehicles.map(v=>`<option value="${E(v.id)}" ${v.id===vehicle?'selected':''}>${E(v.label)}</option>`).join('')}</select></label>
 ${mine?.cover && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(mine.cover)?`<button type="button" class="family-picture-button family-cover-photo" data-cover-preview="1" aria-label="Fahrzeugtitelbild vergrößern"><img src="${mine.cover}" alt="Titelbild des ausgewählten Fahrzeugs" loading="lazy"></button>`:''}
 ${mine?galleryPanel(vehicle):''}
 ${mine?`<div class="family-mileage">Aktueller Stand: <strong>${mine.mileage===null||mine.mileage===undefined?'noch nicht bekannt':Number(mine.mileage).toLocaleString('de-DE')+' km'}</strong></div>`:''}</section>
 ${mine?`<div class="family-grid"><button data-screen="km" ${screen==='km'?'aria-current="page"':''}>🧭<span>Kilometerstand</span></button><button data-screen="wartung" ${screen==='wartung'?'aria-current="page"':''}>🔧<span>Wartung melden</span></button><button data-screen="hu" ${screen==='hu'?'aria-current="page"':''}>📅<span>HU / AU melden</span></button><button data-screen="mangel" ${screen==='mangel'?'aria-current="page"':''}>📣<span>Mangel melden</span></button></div>
 <section class="family-card">${screen==='home'?`<h2>Was möchtest du eintragen?</h2><p>Wähle oben eine der vier Möglichkeiten.</p>`:formFor(screen,mine)}</section>
 <section class="family-card"><h2>🔔 Anstehende Wartungen und HU</h2>${(data.services||[]).filter(s=>s.vehicle_id===vehicle).slice(0,15).map(s=>`<div class="family-event"><b>${E(s.title)}</b><p>${E([s.due_month?s.due_month:s.due_date?(formatDate(s.due_date)):'',s.due_mileage?Number(s.due_mileage).toLocaleString('de-DE')+' km':''].filter(Boolean).join(' · ')||'Termin noch nicht angegeben')}</p></div>`).join('')||'<p>Für dieses Fahrzeug sind keine offenen Termine freigegeben.</p>'}</section>
 <details class="family-card family-help"><summary>ℹ️ So funktioniert’s</summary><ul><li>Fahrzeug auswählen.</li><li>Kilometerstand eintragen oder Wartung / HU melden.</li><li>Bei einem Mangel reicht eine kurze Beschreibung.</li><li>HU und Wartung bestätigt Björn, bevor sie verbindlich übernommen werden.</li><li>Unter „Letzte Meldungen“ siehst du den Bearbeitungsstand.</li></ul></details>
 <section class="family-card"><div class="family-flex"><h2>Letzte Meldungen</h2><button class="family-minibutton" id="family-refresh">↻ Aktualisieren</button></div>${(data.events||[]).filter(e=>e.vehicle_id===vehicle&&!['Gelöscht','Zurückgezogen'].includes(e.status)).slice(0,12).map(e=>`<div class="family-event"><b>${E(({mangel:'Mangel',km:'Kilometerstand',hu:'HU / AU',wartung:'Wartung'}[e.kind]||e.kind))}</b><small>${E(formatDate(e.created_at))} · ${E(e.status)} · von ${E(e.reporter||'unbekannt')}</small><p>${E(e.text||(e.kind==='km'?'Kilometerstand eingetragen':'Gemeldet'))}</p>${(repliesByEvent[e.id]||[]).map(r=>`<div class="family-reply"><strong>🔧 Antwort der Werkstatt</strong><p>${E(r.text)}</p><small>${E(formatDate(r.at))}</small></div>`).join('')}${owned()[e.id]&&['mangel','wartung','hu'].includes(e.kind)&&!['Erledigt','Übernommen','Abgelehnt','Zurückgezogen','Gelöscht'].includes(e.status)?`<button class="family-minibutton" data-withdraw="${E(e.id)}">Eigene Meldung löschen</button>`:''}</div>`).join('')||'<p>Zu diesem Fahrzeug noch keine Meldungen vorhanden.</p>'}</section>`:'<div class="family-card">Bitte oben ein Fahrzeug auswählen.</div>'}
 <button class="family-logout" id="family-logout">Familienzugang auf diesem Gerät abmelden</button>`}
${data?ownerPanel():''}<button type="button" class="family-picture-button family-picture-last" data-picture="assets/werkstattabschluss.png" aria-label="Abschlussbild vergrößern"><img src="assets/werkstattabschluss.png" alt="Warme Ford-Werkstattszene mit Haustieren" loading="lazy"></button><footer>🛠️ Mit Björns Werkstatt verbunden · Nur freigegebene Fahrzeugdaten sichtbar</footer></div><dialog class="family-picture-dialog" id="family-picture-dialog" aria-label="Bild vergrößert anzeigen"><button type="button" class="family-picture-close" aria-label="Bild schließen">×</button><img alt="Vergrößerte Werkstattillustration"></dialog>`}

async function smallPhoto(file){
 if(!file.type.startsWith('image/'))throw Error('Bitte nur Bilddateien auswählen.');
 const bitmap=await createImageBitmap(file);try{
  const c=document.createElement('canvas');const factor=Math.min(1,820/Math.max(bitmap.width,bitmap.height));c.width=Math.max(1,Math.round(bitmap.width*factor));c.height=Math.max(1,Math.round(bitmap.height*factor));c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);
  for(const q of [.68,.52,.38,.27]){const str=c.toDataURL('image/jpeg',q);if(str.length<=76000)return str;}
  throw Error('Foto ist zu groß. Bitte eine kleinere Aufnahme wählen.');
 }finally{bitmap.close()}
}
function formFor(kind,v){if(kind==='km')return `<h2>🧭 Kilometerstand</h2><p>Eintragen – der neue Stand ist direkt im Cloudbestand.</p><form id="family-entry"><label>Aktueller Kilometerstand<input name="km" type="number" min="0" max="2000000" step="1" value="${Number(v.mileage||0)||''}" required></label><button type="submit" class="family-button" ${busy?'disabled':''}>Kilometerstand speichern</button></form>`;
if(kind==='mangel')return `<h2>📣 Was klappert denn da?</h2><p>Beschreibe den Mangel. Die Hilfen und Fotos sind freiwillig.</p><form id="family-entry"><label>Deine Meldung<textarea name="text" rows="5" maxlength="2000" minlength="3" required placeholder="Zum Beispiel: Beim Bremsen quietscht es vorne rechts …"></textarea></label><label>Was fällt auf? (optional)<select name="topic"><option value="">Keine Auswahl</option>${['Geräusch','Warnleuchte','Motor / Antrieb','Bremsen','Fahrwerk / Lenkung','Elektrik','Undichtigkeit','Sonstiges'].map(x=>`<option>${E(x)}</option>`).join('')}</select></label><label>Wann tritt es auf? (optional)<select name="when"><option value="">Keine Auswahl</option>${['Beim Starten','Während der Fahrt','Beim Beschleunigen','Beim Bremsen','Im Stand','Nur gelegentlich'].map(x=>`<option>${E(x)}</option>`).join('')}</select></label><label>Wo tritt es auf? (optional)<select name="where"><option value="">Keine Auswahl</option>${['Vorne','Hinten','Links','Rechts','Motorraum','Innenraum','Unbekannt'].map(x=>`<option>${E(x)}</option>`).join('')}</select></label><fieldset class="family-photo-fieldset"><legend>Fotos (optional) – bis zu 3</legend><div class="family-photo-grid">${[0,1,2].map(i=>`<div class="family-photo-slot" data-photo-slot="${i}"><label class="family-photo-picker" for="family-photo-${i}"><span class="family-slot-empty">📷<small>Foto ${i+1}<br>auswählen</small></span><img class="family-slot-image" alt="Vorschau Foto ${i+1}" hidden></label><input class="family-photo-input" type="file" id="family-photo-${i}" data-photo-input="${i}" accept="image/*" aria-label="Foto ${i+1} auswählen"><button class="family-photo-remove" type="button" data-photo-remove="${i}" hidden>Entfernen</button></div>`).join('')}</div></fieldset><p class="family-photo-hint">Jedes Foto einzeln auswählen, austauschen oder entfernen. Alle ausgewählten Fotos werden vor dem Senden verkleinert.</p><button type="submit" class="family-button" ${busy?'disabled':''}>Mangel absenden</button></form>`;
if(kind==='wartung')return `<h2>🔧 Wartung durchgeführt</h2><p>Björn prüft deine Angabe und bestätigt sie.</p><form id="family-entry"><label>Was wurde gemacht?<input name="text" required maxlength="300" placeholder="Ölwechsel und Filter …"></label><label>Datum<input type="date" name="date" required value="${new Date().toLocaleDateString('sv-SE')}"></label><label>Kilometerstand (optional)<input type="number" name="km" min="0" max="2000000"></label><button type="submit" class="family-button" ${busy?'disabled':''}>Wartung melden</button></form>`;
return `<h2>📅 HU / AU durchgeführt</h2><p>Die neue HU wird erst nach Björns Freigabe verbindlich.</p><form id="family-entry"><label>Datum der Untersuchung<input type="date" name="date" required value="${new Date().toLocaleDateString('sv-SE')}"></label><label>Nächste HU fällig (optional)<input type="month" name="next"></label><label>Kilometerstand (optional)<input type="number" name="km" min="0" max="2000000"></label><button class="family-button" type="submit" ${busy?'disabled':''}>HU melden</button></form>`;}
document.addEventListener('change',e=>{if(e.target.matches('[data-photo-input]')){
 const i=Number(e.target.dataset.photoInput),file=e.target.files?.[0]||null;
 if(file&&!file.type.startsWith('image/')){e.target.value='';error='Bitte nur Bilddateien auswählen.';return;}
 if(photoPreviewUrls[i])URL.revokeObjectURL(photoPreviewUrls[i]);
 photoSlots[i]=file;photoPreviewUrls[i]=file?URL.createObjectURL(file):null;
 updatePhotoSlot(i);e.target.value='';return;
}if(e.target.id==='family-name'){localStorage.setItem(NAMEKEY,e.target.value.trim().slice(0,80));return}if(e.target.id==='family-vehicle'){vehicle=e.target.value;resetPhotoSlots();screen='home';notice='';draw();if(vehicle)galleryLoad(vehicle)}});
document.addEventListener('click',async e=>{const removePhoto=e.target.closest('[data-photo-remove]');if(removePhoto){const i=Number(removePhoto.dataset.photoRemove);if(photoPreviewUrls[i])URL.revokeObjectURL(photoPreviewUrls[i]);photoSlots[i]=null;photoPreviewUrls[i]=null;updatePhotoSlot(i);return;}const gv=e.target.closest('[data-gallery-view]');if(gv){const item=(galleryByVehicle[vehicle]||[]).find(x=>x.id===gv.dataset.galleryView);if(item){const d=document.getElementById('family-picture-dialog');d.querySelector('img').src=item.photo;d.showModal();}return;}
const gd=e.target.closest('[data-gallery-delete]');if(gd){if(!confirm('Eigenes Fahrzeugfoto wirklich löschen?'))return;try{await call('fw_family_gallery_delete',{p_share_id:cfg.share_id,p_token:token,p_vehicle_id:vehicle,p_photo_id:gd.dataset.galleryDelete,p_proof:localStorage.getItem('fw-gallery-proof:'+gd.dataset.galleryDelete)||''});await galleryLoad(vehicle);}catch(ex){error=ex.message;draw()}return;}
const picture=e.target.closest('[data-picture],[data-cover-preview]');if(picture){const dialog=document.getElementById('family-picture-dialog');if(dialog){const preview=picture.querySelector('img');const full=dialog.querySelector('img');full.src=picture.dataset.coverPreview ? (preview?.src||'') : picture.dataset.picture;full.alt=preview?.alt||'Werkstattbild';dialog.showModal()}return}if(e.target.closest('.family-picture-close')||e.target.classList.contains('family-picture-dialog')){document.getElementById('family-picture-dialog')?.close();return}const wd=e.target.closest('[data-withdraw]');if(wd){const id=wd.dataset.withdraw,secret=owned()[id];if(!secret||!confirm('Eigene Meldung entfernen? Bereits freigegebene Arbeiten bleiben bestehen.'))return;wd.disabled=true;try{await call('fw_family_withdraw',{p_share_id:cfg.share_id,p_token:token,p_event_id:id,p_proof:secret});await refresh();notice='Meldung zurückgezogen.';draw()}catch(err){error=err.message;draw()}return}const a=e.target.closest('[data-screen]');if(a){screen=a.dataset.screen;notice='';error='';draw();return}if(e.target.closest('#family-refresh')){refresh();return}if(e.target.closest('#family-logout')){localStorage.removeItem(tokenKey());token='';data=null;vehicle='';resetPhotoSlots();screen='home';notice='';draw();if(vehicle)galleryLoad(vehicle)}});
document.addEventListener('submit',async e=>{const form=e.target;if(!form.matches('#family-login,#family-entry'))return;e.preventDefault();if(busy)return;busy=true;error='';notice='';const button=form.querySelector('button[type=submit]');button.disabled=true;try{if(form.id==='family-login'){const pin=String(new FormData(form).get('pin'));const session=await call('fw_family_enter',{p_share_id:cfg.share_id,p_pin:pin});token=session.token;localStorage.setItem(tokenKey(),token);await refresh();notice='Willkommen!';draw();return}
if(!vehicle)throw Error('Bitte Fahrzeug auswählen.');const f=new FormData(form),payload={};for(const [k,v] of f){payload[k]=String(v).trim()}const kind=screen;const visibleName=document.getElementById('family-name')?.value.trim()||memberName();if(!visibleName||visibleName.length>80)throw Error('Bitte zuerst deinen Namen eintragen.');localStorage.setItem(NAMEKEY,visibleName);payload.reporter=visibleName;const secret=makeSecret();payload.proof=secret;const selected=kind==='mangel'?photoSlots.filter(Boolean):[];
 if(selected.length>3)throw Error('Maximal drei Fotos auswählen.');
 const photos=[];for(const file of selected)photos.push(await smallPhoto(file));
 // Die Metadaten bleiben optional und die vorhandene Meldungs-RPC bleibt unverändert.
 const meta={};for(const key of ['topic','when','where']){if(payload[key])meta[key]=payload[key];delete payload[key]}
 const sent=await call('fw_family_send',{p_share_id:cfg.share_id,p_token:token,p_vehicle_id:vehicle,p_kind:kind,p_payload:payload});if(sent?.id)rememberOwned(sent.id,secret);
 // Zwei Phasen: zuerst Meldung, dann geschützter Foto-Upload mit Proof.
 // Bei einem Fehler bleibt die Meldung erhalten; zeige den Fehler ausdrücklich.
 if(kind==='mangel'&&(photos.length||Object.keys(meta).length)){
  if(!sent?.id)throw Error('Meldung gespeichert, aber Foto-Zuordnung nicht möglich.');
  try{await call('fw_family_photo',{p_share_id:cfg.share_id,p_token:token,p_event_id:sent.id,p_proof:secret,p_photos:photos,p_meta:meta})}
  catch(err){await refresh();throw Error('Meldung wurde gesendet, aber Fotos/Hilfen nicht gespeichert: '+err.message)}
 }
 resetPhotoSlots();screen='home';await refresh();notice='Danke! '+({hu:'HU wartet auf Freigabe.',wartung:'Wartung wartet auf Freigabe.',mangel:'Dein Mangel ist gemeldet.',km:'Kilometerstand übernommen.'}[kind]||'Meldung ist angekommen.');draw();
}catch(err){error=err.message;draw()}finally{busy=false;if(button.isConnected)button.disabled=false}});
// Besitzeraktionen greifen ausschließlich auf serverseitig geschützte RPCs zu.
document.addEventListener('submit',async e=>{if(e.target.id!=='family-gallery-upload')return;e.preventDefault();if(galleryBusy||!vehicle)return;galleryBusy=true;
 const f=new FormData(e.target);try{const file=f.get('photo');if(!(file instanceof File)||!file.size)throw Error('Bitte Foto auswählen.');
 const picture=await smallPhoto(file);const proof=makeSecret();
 const result=await call('fw_family_gallery_add',{p_share_id:cfg.share_id,p_token:token,p_vehicle_id:vehicle,p_photo:picture,p_caption:String(f.get('caption')||'').trim(),p_proof:proof});
 if(result?.id)localStorage.setItem('fw-gallery-proof:'+result.id,proof);await galleryLoad(vehicle);notice='Foto gespeichert.';draw();
 }catch(ex){error=ex.message;draw()}finally{galleryBusy=false;}
});
document.addEventListener('input',e=>{if(e.target.id==='family-owner-search'){ownerSearch=e.target.value;/* Filter auf Eingabe anwenden ohne Verlust des Fokus */const pos=e.target.selectionStart;draw();const x=document.getElementById('family-owner-search');x?.focus();x?.setSelectionRange(pos,pos);}});
document.addEventListener('toggle',e=>{if(e.target?.id==='family-owner-panel')ownerOpen=e.target.open},true);
document.addEventListener('submit',async e=>{
 if(e.target.id!=='family-owner-login')return;e.preventDefault();if(ownerLoading)return;
 const f=e.target,button=f.querySelector('button[type=submit]'),values=new FormData(f);
 ownerLoading=true;ownerError='';if(button)button.disabled=true;
 try{
  const res=await fetch(cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({email:String(values.get('email')||'').trim(),password:String(values.get('password')||'')}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  const session=await res.json().catch(()=>({}));if(!res.ok||!session.access_token)throw Error('Anmeldung fehlgeschlagen. Bitte deine Werkstatt-Zugangsdaten prüfen.');
  await ownerCheck(session.access_token);
 }catch(err){ownerError=err.message;ownerToken='';ownerOpen=true;draw();}
 finally{ownerLoading=false;if(button?.isConnected)button.disabled=false;}
});
document.addEventListener('click',async e=>{
 const useExisting=e.target.closest('[data-owner-existing]'),logout=e.target.closest('[data-owner-logout]'),reload=e.target.closest('[data-owner-refresh]'),remove=e.target.closest('[data-owner-delete]'),restore=e.target.closest('[data-owner-restore]'),permanent=e.target.closest('[data-owner-permanent]');
 if(!useExisting&&!logout&&!reload&&!remove&&!restore&&!permanent)return;e.preventDefault();
 if(logout){ownerToken='';ownerItems=[];ownerVehicles=[];ownerError='';ownerNote='Admin abgemeldet. Der normale Familienzugang bleibt bestehen.';ownerOpen=true;draw();return;}
 if(ownerLoading)return;ownerLoading=true;ownerOpen=true;ownerError='';ownerNote='';
 try{
  if(useExisting){
   const conf=JSON.parse(localStorage.getItem('fwcloud.config.v1')||'null');
   const session=JSON.parse(localStorage.getItem('fwcloud.session.v1')||'null');
   if(!conf||conf.url!==cfg.url||!session?.access_token)throw Error('Auf diesem Gerät ist keine passende persönliche iPhone-Werkstatt-Anmeldung vorhanden. Bitte oben als Admin anmelden.');
   await ownerCheck(session.access_token);
  }else if(reload){const state=await ownerCall('fw_family_admin_state',{});if(!state||!Array.isArray(state.events))throw Error('Adminmeldungen konnten nicht geladen werden.');ownerItems=state.events;ownerVehicles=state.vehicles||[];ownerTrash=await ownerCall('fw_family_admin_trash',{});ownerNote='Aktuelle Meldungen geladen.';}
  else if(restore||permanent){const id=(restore||permanent).dataset.ownerRestore||(restore||permanent).dataset.ownerPermanent;
   if(!ownerTrash.some(row=>row.id===id))throw Error('Meldung nicht im Papierkorb.');
   if(!confirm(permanent?'Diese Meldung UNWIDERRUFLICH löschen?':'Meldung wiederherstellen?'))return;
   await ownerCall('fw_family_admin_trash_action',{p_event_id:id,p_action:permanent?'purge':'restore'});
   const state=await ownerCall('fw_family_admin_state',{});ownerItems=state.events;ownerVehicles=state.vehicles||[];ownerTrash=await ownerCall('fw_family_admin_trash',{});
   ownerNote=permanent?'Meldung endgültig gelöscht.':'Meldung wiederhergestellt.';await refresh();
  }
  else if(remove){const id=remove.dataset.ownerDelete;
   if(!/^[a-f0-9-]{36}$/i.test(id)||!ownerItems.some(row=>String(row.id)===id))throw Error('Meldung nicht mehr vorhanden. Bitte aktualisieren.');
   if(!confirm('Diese Meldung wirklich aus der Familienübersicht entfernen und in den Papierkorb verschieben? Bestehende Diagnosen und Wartungen bleiben erhalten.'))return;
   await ownerCall('fw_family_admin_event',{p_event_id:id,p_action:'delete',p_value:''});
   const state=await ownerCall('fw_family_admin_state',{});if(!state||!Array.isArray(state.events))throw Error('Meldung geändert, aber Adminliste konnte nicht aktualisiert werden.');ownerItems=state.events;ownerVehicles=state.vehicles||[];ownerTrash=await ownerCall('fw_family_admin_trash',{});ownerNote='Meldung in den Papierkorb verschoben.';
   // Familienansicht synchron nachziehen; archivierte Meldungen werden ausgeblendet.
   await refresh();
  }
 }catch(err){ownerError=err.message;if(/berechtigung|401|403|jwt|token|abgelaufen/i.test(ownerError)){ownerToken='';ownerItems=[];}}
 finally{ownerLoading=false;draw();}
});
async function init(){try{const res=await fetch('./config.json',{cache:'no-store'});if(!res.ok)throw Error('Noch nicht konfiguriert');const s=await res.json();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(s.url)||!(s.key.startsWith('sb_publishable_')||s.key.startsWith('eyJ'))||!/^[0-9a-f-]{36}$/.test(s.share_id))throw Error('config.json noch nicht eingerichtet');const id=new URLSearchParams(location.search).get('projekt');if(id&&id!==s.share_id)throw Error('Dieser Familienlink gehört zu einem anderen Fahrzeugbestand');cfg=s;token=localStorage.getItem(tokenKey())||'';if(token)await refresh();else draw()}catch(e){error=e.message;draw()}}
init();
})();
