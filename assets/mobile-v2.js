/* Mobile 2.1. Keeps the original 0.1/0.2 IndexedDB database and stores.
   Writes canonical UUID records transactionally. Source snapshot and v0.2 notes
   remain archived in metadata until the user exports a separate backup. */
'use strict';
const M=FWModel;
let mobileDoc=null,mobileSyncUI=null,mobileEditing=false,mobileSaving=false,mobileUpdating=false;
let mobileUpdateRegistration=null,mobileUpdateReload=false;
const baseHome=home,baseVehicleDetails=vehicleDetails,baseVehicleList=vehicleList,baseCaseCard=caseCard,baseMore=more;
const oldBind=bind;
const LOCAL_DOC='documentV2',SYNC_STATE='syncStateV2';
const mobileDate=()=>new Date().toLocaleDateString('sv-SE');
function atomicMeta(entries,files=[]){return new Promise((resolve,reject)=>{const tx=db.transaction(['meta','files'],'readwrite');for(const [key,value]of Object.entries(entries))tx.objectStore('meta').put(value,key);for(const [name,blob]of files)tx.objectStore('files').put(blob,name);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Speichern abgebrochen.'));})}
function normalizeView(){app.snap=M.toPortable(mobileDoc);app.vehicles=rows('vehicles');app.brands=rows('brands');app.localEntries=[];}
async function commitLocal(next,files=[]){M.validate(next);const previous=M.clone(mobileDoc);await new Promise((ok,no)=>{const tx=db.transaction(['meta','files'],'readwrite'),store=tx.objectStore('meta'),check=store.get(LOCAL_DOC);check.onsuccess=()=>{if(!M.equal(check.result,previous)){tx.abort();return;}store.put(next,LOCAL_DOC);for(const [name,blob]of files)tx.objectStore('files').put(blob,name);};tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error||Error('Anderes Fenster hat inzwischen gespeichert. Nichts überschrieben; Eingabe sichern und Datenstand neu laden.'));});mobileDoc=next;normalizeView();if(window.fwCloud?.config?.enabled)window.fwCloud.status('Änderungen gespeichert · Abgleich folgt','waiting');window.fwCloud?.schedule(1800);}
async function migrate02(){const saved=await kvGet('meta',LOCAL_DOC);if(saved)return await upgradeMobile21(saved);const source=await kvGet('meta','snapshot'),entries=await kvGet('meta','mobileEntries')||[];const doc=source?M.fromPortable(source):M.empty();const baseline=M.clone(doc),lookup={};for(const r of source?.entities?.vehicles||[])lookup[String(r.data.id)]=r.portable_id;
 for(const old of entries){const vehicle=lookup[String(old.vehicle_id)];if(!vehicle)throw Error('Mobile-0.2-Eintrag ohne zugeordnetes Fahrzeug. Originaldaten bleiben erhalten; bitte zuerst sichern.');const uid=M.UUID.test(old.id)?old.id:crypto.randomUUID();let table,data;const notes=['Übernommen aus Mobile 0.2: '+old.kind,'Erfasst am '+(old.date||''),old.notes||''].join('\n');if(old.kind==='Wartung'){table='maintenance';data=M.defaults(table,{vehicle_id:vehicle,title:old.title||'Mobile Wartungsnotiz',notes,created_at:old.created_at||new Date().toISOString()});}else{table='cases';data=M.defaults(table,{vehicle_id:vehicle,date:old.date||mobileDate(),description:old.title||'Mobile Notiz',dtc_code:old.dtc||'',notes,created_at:old.created_at||new Date().toISOString()});}doc.records[M.key(table,uid)]={entity:table,uid,deleted:false,data};}
 M.validate(doc);await atomicMeta({[LOCAL_DOC]:doc,[SYNC_STATE]:{initial_base:baseline,revision:0},migration02:{date:new Date().toISOString(),snapshot:source,entries}});return doc;
}
// Schema upgrades keep a copy of the original document and merge base in the
// SAME IndexedDB transaction. The existing stores, files and login stay intact.
async function upgradeMobile21(saved) {
 const upgraded=M.upgrade(saved); M.validate(upgraded);
 if(M.equal(saved,upgraded))return saved;
 const oldState=await kvGet('meta',SYNC_STATE)||{};
 const nextState=M.clone(oldState);
 for(const key of ['base','initial_base'])if(nextState[key])nextState[key]=M.upgrade(nextState[key]);
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('meta','readwrite'),store=tx.objectStore('meta');
  const request=store.get(LOCAL_DOC);
  request.onsuccess=()=>{
   if(!M.equal(request.result,saved)){tx.abort();return;}
   const stateRequest=store.get(SYNC_STATE);
   stateRequest.onsuccess=()=>{
    if(!M.equal(stateRequest.result||{},oldState)){tx.abort();return;}
    const backup=store.get('before_upgrade_22');
    backup.onsuccess=()=>{
     if(!backup.result)store.put({created_at:new Date().toISOString(),doc:saved,state:oldState},'before_upgrade_22');
     store.put(upgraded,LOCAL_DOC);store.put(nextState,SYNC_STATE);
    };
   };
  };
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Der Datenstand wurde in einem anderen Fenster geändert. Bitte andere Werkstattfenster schließen und erneut öffnen.'));
 });
 return upgraded;
}
function mobileUpdateBanner(){
 if(!mobileUpdateRegistration?.waiting)return '';
 return '<section class="mobile-update21" role="status"><b>Ein Programmupdate ist bereit.</b><p>Gespeicherte Fahrzeugdaten und die Cloud-Verbindung bleiben erhalten.</p><button class="btn secondary" id="mobile-update-apply">Update laden</button><small>Eingaben zuerst speichern. Danach wird die App neu geladen.</small></section>';
}
function showMobileUpdate(registration){
 mobileUpdateRegistration=registration;
 if(!registration.waiting)return;
 if(mobileEditing||mobileSaving){
  if(!document.querySelector('.mobile-update21'))document.querySelector('.top')?.insertAdjacentHTML('afterend',mobileUpdateBanner());
  if($('mobile-update-apply'))$('mobile-update-apply').onclick=applyMobileUpdate;
 }else render();
}
async function applyMobileUpdate(){
 const panel=document.querySelector('.mobile-update21');
 if(mobileEditing||mobileSaving||app.importBusy||window.fwCloud?.busy){
  if(panel)panel.querySelector('small').textContent='Bitte die aktuelle Eingabe speichern und laufende Vorgänge abwarten.';
  return;
 }
 const worker=mobileUpdateRegistration?.waiting;if(!worker)return;
 mobileUpdating=true;mobileUpdateReload=true;window.fwCloud?.stop();
 worker.postMessage({type:'SKIP_WAITING'});
}
async function registerMobileWorker(){
 if(!('serviceWorker'in navigator)||!(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname)))return;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(mobileUpdateReload&&!mobileEditing&&!mobileSaving)location.reload();});
 const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
 if(registration.waiting)showMobileUpdate(registration);
 registration.addEventListener('updatefound',()=>{
  const worker=registration.installing;
  worker?.addEventListener('statechange',()=>{
   if(worker.state==='installed'&&navigator.serviceWorker.controller)showMobileUpdate(registration);
  });
 });
 registration.update().catch(()=>{});
}
function cloudStrip(){const s=window.fwCloud?.lastStatus||{text:'Cloud noch nicht eingerichtet',kind:'off'};return `<button class="sync-strip ${esc(s.kind)}" data-nav="cloud" data-mobile-sync-strip>⇄ ${esc(s.text)}</button>`}
home=function(){const html=baseHome().replace('Fahrzeuge, Diagnosen und Wissen aus deinem letzten mobilen Export.','Deine Fahrzeuge und dein Werkstattwissen – lokal verfügbar, mit optionalem automatischem Abgleich.').replace('Lokale Lesekopie, keine automatische Synchronisation.','Lokal gespeichert. Den Abgleichstatus findest du oben.').replace('Export vom','Lokaler Datenstand vom').replace('Fahrzeuge und Anhänge bleiben auf diesem Gerät; die App lädt deine importierten Daten nicht auf den Webhost.','GitHub enthält keine Fahrzeugdaten. Nach deiner Cloud-Freigabe werden Daten zusätzlich im privaten Cloud-Projekt gespeichert.');const urgent=rows('maintenance').filter(m=>veh(m.vehicle_id)?.status!=='Archiviert').map(m=>({m,s:M.maintenanceState(m,veh(m.vehicle_id))})).filter(x=>['soon','due','late'].includes(x.s.level));return cloudStrip()+html+`<section><h2>Wartung im Blick</h2>${urgent.map(({m,s})=>`<article class="item" data-vehicle="${esc(m.vehicle_id)}"><b>${esc(m.title)}</b><p>${esc(vehicleName(veh(m.vehicle_id)||{}))}</p><span class="pill ${s.level==='late'?'error':'warn'}">${esc(s.text)}</span><p>${esc(maintenanceLabel(m))}</p></article>`).join('')||'<p class="empty">Nach deinen eingetragenen Terminen ist derzeit nichts vorgewarnt oder fällig.</p>'}</section>`;};
vehicleList=function(){return cloudStrip()+baseVehicleList().replace('<button class="btn orange" id="new-mobile-entry">+ Unterwegs notieren</button>','<div class="actions"><button class="btn" data-edit-entity="vehicles">+ Fahrzeug hinzufügen</button><button class="btn secondary" data-edit-entity="cases">+ Diagnose / Notiz</button></div>');};
caseCard=function(c){return baseCaseCard(c)+`<div class="actions case-actions"><button class="btn secondary" data-edit-entity="cases" data-edit-id="${esc(c.id)}">Fall bearbeiten</button><button class="btn secondary" data-report-case="${esc(c.id)}">Bericht / PDF</button><button class="btn secondary" data-edit-entity="case_steps" data-parent-case="${esc(c.id)}">+ Prüfschritt</button></div><div class="step-links">${rows('case_steps').filter(s=>s.case_id===c.id).map(s=>`<button class="back" data-edit-entity="case_steps" data-edit-id="${esc(s.id)}">${esc(s.title)} bearbeiten</button>`).join('')}</div>`;};
vehicleDetails=function(v){const original=baseVehicleDetails(v).replace('<h2>Mobile Notizen</h2>'+mobileCards(v.id),'').replace('data-mobile-vehicle="'+esc(v.id)+'"','data-edit-entity="cases" data-parent-vehicle="'+esc(v.id)+'"').replace('+ Eintrag unterwegs','+ Diagnose / Notiz');return cloudStrip()+`<div class="actions"><button class="btn" data-edit-entity="vehicles" data-edit-id="${esc(v.id)}">Fahrzeug bearbeiten</button><button class="btn secondary" data-archive="${esc(v.id)}">${v.status==='Archiviert'?'Reaktivieren':'Archivieren'}</button></div>`+original+`<section class="panel"><h2>Weitere Einträge</h2><div class="actions"><button class="btn" data-edit-entity="maintenance" data-parent-vehicle="${esc(v.id)}">+ Wartung</button><button class="btn secondary" data-edit-entity="expenses" data-parent-vehicle="${esc(v.id)}">+ Kosten</button><button class="btn orange" data-add-file="${esc(v.id)}">+ Foto / Dokument</button></div>${rows('maintenance').filter(m=>m.vehicle_id===v.id).map(m=>`<div class="detail"><span class="pill ${M.maintenanceState(m,v).level==='late'?'error':'warn'}">${esc(M.maintenanceState(m,v).text)}</span> <b>${esc(m.title)}</b><div><button class="back" data-edit-entity="maintenance" data-edit-id="${esc(m.id)}">Wartung bearbeiten</button></div></div>`).join('')}${rows('expenses').filter(e=>e.vehicle_id===v.id).map(e=>`<p><button class="back" data-edit-entity="expenses" data-edit-id="${esc(e.id)}">Kosten bearbeiten: ${esc(e.description)}</button></p>`).join('')}</section>`;};
function metaBackupPanel(){return `<section class="panel"><h2>Sicherung und Übernahme</h2><p>Vor dem ersten Cloud-Abgleich und vor Updates eine mobile Vollsicherung speichern. Sie enthält den lokalen Datenbestand, mobile Ergänzungen und die vorhandenen Anhänge – keine Anmeldeschlüssel.</p><div class="actions"><button class="btn" id="backup-mobile-v2">Mobile Vollsicherung erstellen</button><button class="btn secondary" id="export-old-notes">0.2-Originalnotizen sichern</button></div><label class="field">Mobile Vollsicherung wiederherstellen<input type="file" id="restore-mobile-v2" accept=".zip,application/zip"></label><p class="small muted">Eine Wiederherstellung ist kein normaler Geräteabgleich. Cloud wird dabei pausiert. Windows-Vollsicherungen lassen sich hier nicht einlesen.</p><h3>Windows-Export als Anfangsbestand</h3><p class="small">Nur vor dem ersten Abgleich. Ein bestehender 2.0-Datenbestand wird dabei nicht ersetzt.</p><input type="file" id="input-file" accept=".zip,application/zip"><div class="actions"><button class="btn secondary" id="check-offline">Offline-Dateien prüfen</button><button class="btn secondary" id="request-persist">Speicherfreigabe anfragen</button></div></section>`;}
more=function(){return cloudStrip()+`<h1>Deine Werkstatt</h1><section class="panel"><h2>Automatischer Abgleich</h2><p>Einmal am Surface und auf dem iPhone mit demselben privaten Werkstattzugang verbinden. Danach kein ZIP-Austausch im Alltag.</p><button class="btn" data-nav="cloud">Abgleich & Geräte öffnen</button></section>`+metaBackupPanel()+`<section class="panel"><h2>Mobile 2.2.0</h2><p>Die Oberfläche muss für automatischen Abgleich geöffnet bzw. aktiv sein. Ein ausgeschaltetes Surface ist kein Hindernis für das iPhone: Die private Cloud hält den gemeinsamen Stand.</p><p>Wartungswarnungen sind sichtbar, wenn du die App öffnest. Keine garantierten Hintergrundbenachrichtigungen. Cloud-Speicher ist keine unabhängige Sicherung.</p><p class="small">Lokaler Browserspeicher kann vom Betriebssystem oder durch Löschen von Websitedaten entfernt werden. Regelmäßig eine zusätzliche Sicherung aufbewahren.</p></section>`;};
function field(label,name,value='',type='text',options=[],required=false){const id='edit-'+name;let ctrl;if(type==='select'&&value!==null&&value!==undefined&&String(value)!==''&&!options.some(o=>String(Array.isArray(o)?o[0]:o)===String(value)))options=[[value,String(value)+' (vorhanden)'],...options];if(type==='select')ctrl=`<select id="${id}" name="${name}" ${required?'required':''}>${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(value??'')===String(v)?'selected':''}>${esc(l)}</option>`}).join('')}</select>`;else if(type==='textarea')ctrl=`<textarea id="${id}" name="${name}" rows="4" maxlength="20000">${esc(value??'')}</textarea>`;else ctrl=`<input id="${id}" name="${name}" type="${type}" value="${esc(value??'')}" ${required?'required':''} ${type==='number'?'min="0" step="1"':''} ${type==='text'?'maxlength="500"':''}>`;return `<label for="${id}">${esc(label)}${required?' *':''}${ctrl}</label>`}
function vehicleOptions2(){return [['','Bitte wählen'],...app.vehicles.map(v=>[v.id,vehicleName(v)])]}
function softwareOptions2(){return [['','Nicht angegeben'],...rows('software').map(v=>[v.id,v.name])]}
function adapterOptions2(){return [['','Nicht angegeben'],...rows('adapters').map(v=>[v.id,v.name])]}
function openEditor(entity,id=null,vehicleId=null,caseId=null){if(!['vehicles','cases','maintenance','expenses','case_steps'].includes(entity))return;const old=mobileDoc.records[M.key(entity,id)]?.data||{};const d=M.defaults(entity,{...old});if(vehicleId&&'vehicle_id'in d)d.vehicle_id=vehicleId;if(caseId&&'case_id'in d)d.case_id=caseId;const labels={vehicles:'Fahrzeug',cases:'Diagnose / Reparatur / Notiz',maintenance:'Wartung',expenses:'Kosten',case_steps:'Prüfschritt'};let form='';const add=(l,f,t='text',o=[],r=false)=>form+=field(l,f,d[f],t,o,r);
 if(entity==='vehicles'){add('Hersteller','brand_id','select',[['','Bitte wählen'],...app.brands.map(b=>[b.id,b.name]),['__new__','Neuen Hersteller eingeben …']],true);form+=field('Nur bei neuem Hersteller: Name','new_brand');add('Modell','model','text',[],true);add('Baujahr','build_year','number');add('Motor','engine');add('Motorcode','engine_code');add('Leistung (PS / kW)','power');add('Kraftstoff','fuel','select',[...new Set(['','Diesel','Benzin','Hybrid','Plug-in-Hybrid','Benzin-Mildhybrid','Diesel-Mildhybrid','Elektro','CNG','LPG','Gas','Sonstiges',...(d.fuel?[d.fuel]:[])])]);add('Kilometerstand','mileage','number');add('Stand vom','mileage_date','date');add('Kennzeichen','plate');add('FIN (optional)','vin');add('HSN · Feld 2.1','hsn');add('TSN · Feld 2.2','tsn');add('Sommerreifen · vorne / beide','summer_tires');add('Winterreifen · vorne / beide','winter_tires');add('Sommerreifen · hinten (abweichend)','summer_tires_rear');add('Winterreifen · hinten (abweichend)','winter_tires_rear');add('Ganzjahresreifen · vorne / beide','all_season_tires');add('Ganzjahresreifen · hinten (abweichend)','all_season_tires_rear');add('Aktuell montiert','tires_mounted','select',[['','Nicht angegeben'],['Sommer','Sommerreifen'],['Winter','Winterreifen'],['Ganzjahr','Ganzjahresreifen']]);add('Besitzer-Kürzel','owner_alias');add('Status','status','select',['Aktiv','Diagnose offen','Archiviert']);add('Favorit','favorite','select',[[0,'Nein'],[1,'Ja']]);add('Notizen','notes','textarea');}
 if(['cases','maintenance','expenses'].includes(entity))add('Fahrzeug','vehicle_id','select',vehicleOptions2(),true);
 if(entity==='cases'){d.date=d.date||mobileDate();add('Datum','date','date',[],true);add('Kilometerstand','mileage','number');add('Beanstandung / Titel','description','textarea',[],true);add('Fehlercode (DTC)','dtc_code');add('Displaymeldung (kein DTC)','display_message');add('Auftretensbedingungen','conditions','textarea');add('Steuergerät','ecu');add('Prüfungen / Messwerte','checks','textarea');add('Tatsächlich gefundene Ursache','root_cause','textarea');add('Reparatur / Ergebnis','resolution','textarea');add('Status','status','select',['Offen','In Prüfung','Wartet auf Teile','Gelöst','Nicht reproduzierbar']);add('Diagnosesoftware','software_id','select',softwareOptions2());add('Adapter','adapter_id','select',adapterOptions2());add('Notizen','notes','textarea');}
 if(entity==='maintenance'){add('Titel','title','text',[],true);add('Kategorie','category','select',['Wartung','HU','Inspektion','Ölwechsel','Sonstiges']);add('Fällig im Monat (z. B. HU)','due_month','month');add('Oder genaues Datum – nicht beides','due_date','date');add('Monate vorher erinnern','remind_months','select',[0,1,2,3,6,12]);add('Fällig bei km','due_mileage','number');add('Kilometer vorher warnen','warn_km','number');add('Status','status','select',['Geplant','Erledigt','Entfällt']);add('Erledigt am','done_date','date');add('Erledigt bei km','done_mileage','number');add('Notizen','notes','textarea');}
 if(entity==='maintenance')form+=FW22.fields(d,(l,k,v,t='text',o={})=>field(l,k,v,t,o.options||[],false));
 if(entity==='expenses'){d.date=d.date||mobileDate();add('Datum','date','date',[],true);add('Beschreibung','description','text',[],true);form+=field('Betrag in Euro','amount_eur',((d.amount_cents||0)/100).toFixed(2).replace('.',','),'text',[],true);add('Kategorie','category','select',['Ersatzteil','Arbeitskosten','Werkstattrechnung','Sonstiges']);add('Lieferant / Werkstatt','supplier');add('Teilenummer','part_number');add('Diagnosefall (gleiches Fahrzeug)','case_id','select',[['','Ohne Fall'],...rows('cases').filter(c=>!d.vehicle_id||c.vehicle_id===d.vehicle_id).map(c=>[c.id,c.date+' · '+c.description])]);add('Notizen','notes','textarea');}
 if(entity==='case_steps'){add('Diagnosefall','case_id','select',[['','Bitte wählen'],...rows('cases').map(c=>[c.id,c.description])],true);add('Prüfung','title','text',[],true);add('Reihenfolge','position','number');add('Status','status','select',['Offen','Erledigt','Nicht möglich','Übersprungen']);add('Ergebnis / Messwert','result','textarea');}
 mobileEditing=true;app.editing=true;inner(chrome(`<section class="panel"><h1>${esc(labels[entity])} ${id?'bearbeiten':'hinzufügen'}</h1><p class="notice">Zuerst lokal gespeichert. Mit eingerichteter Cloud wird anschließend automatisch abgeglichen.</p><form id="editor-v2" class="editor-v2">${form}<p class="status bad" id="editor-error" hidden></p><div class="actions"><button class="btn" type="submit">Speichern</button><button class="btn secondary" type="button" id="editor-cancel">Abbrechen</button></div></form></section>`));
 if(entity==='vehicles'){const year=$('edit-build_year');year.min='1886';year.max='2200';const h=$('edit-hsn'),t=$('edit-tsn');h.inputMode='numeric';h.maxLength=4;h.pattern='[0-9]{4}';t.maxLength=13;t.pattern='[A-Za-z0-9]{3,13}';t.autocapitalize='characters';$('edit-vin').autocapitalize='characters';}const original=new FormData($('editor-v2'));$('editor-cancel').onclick=()=>{if(M.stable(Object.fromEntries(new FormData($('editor-v2'))))!==M.stable(Object.fromEntries(original))&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;mobileEditing=false;app.editing=false;render();};
 $('editor-v2').onsubmit=async e=>{e.preventDefault();if(mobileSaving)return;mobileSaving=true;const button=e.target.querySelector('button[type=submit]');button.disabled=true;try{const next=M.clone(mobileDoc),values=Object.fromEntries(new FormData(e.target)),data={...d};for(const [f,val]of Object.entries(values)){if(!Object.prototype.hasOwnProperty.call(data,f))continue;const schema=M.SCHEMA[entity][f];if(M.FK[entity]?.[f])data[f]=val||null;else if(schema?.type==='INTEGER')data[f]=val===''?null:Number(val);else data[f]=val.trim();}data.updated_at='updated_at'in data?new Date().toISOString():undefined;if(data.updated_at===undefined)delete data.updated_at;
 if(entity==='vehicles'){if(data.brand_id==='__new__'){const name=values.new_brand.trim();if(!name)throw Error('Herstellername fehlt.');const existing=app.brands.find(b=>b.name.toLowerCase()===name.toLowerCase());if(existing)data.brand_id=existing.id;else{const bid=crypto.randomUUID();next.records[M.key('brands',bid)]={entity:'brands',uid:bid,deleted:false,data:{name}};data.brand_id=bid;}}data.vin=(data.vin||'').toUpperCase();data.hsn=(data.hsn||'').trim();data.tsn=(data.tsn||'').trim().toUpperCase();if(data.vin&&app.vehicles.some(v=>v.id!==id&&v.vin?.toUpperCase()===data.vin)&&!confirm('Diese FIN ist bereits vorhanden. Trotzdem als separates Fahrzeug speichern?'))return;if(id&&d.mileage!==null&&data.mileage!==null&&data.mileage<d.mileage&&!confirm('Kilometerstand ist kleiner als bisher. Korrektur wirklich übernehmen?'))return;}
 if(entity==='expenses'){const amount=values.amount_eur.trim();if(!/^\d+(?:[.,]\d{1,2})?$/.test(amount))throw Error('Betrag z. B. 49,90 eingeben.');data.amount_cents=Math.round(Number(amount.replace(',','.'))*100);}
 if(entity==='maintenance'){
  if(data.interval_mode||data.interval_km||data.interval_months){if(!data.interval_origin)data.interval_origin='own';if(!data.interval_key)data.interval_key=FW22.uuid();}
  if(FW22.plannedDuplicate(rows('maintenance'),data,id))throw Error('Diese Katalogarbeit / Wartungsregel ist für das Fahrzeug bereits geplant. Bitte vorhandenen Eintrag bearbeiten.');
 }
 const uid=id||crypto.randomUUID();next.records[M.key(entity,uid)]={entity,uid,deleted:false,data};M.validate(next);await commitLocal(next);mobileEditing=false;app.editing=false;app.page='vehicles';app.selected=entity==='vehicles'?uid:(data.vehicle_id||rows('cases').find(c=>c.id===data.case_id)?.vehicle_id||null);setMessage('Gespeichert. '+(window.fwCloud?.config?.enabled?'Automatischer Abgleich folgt.':'Bisher nur auf diesem Gerät; Cloud noch nicht aktiv.'));}catch(err){$('editor-error').hidden=false;$('editor-error').textContent=err.message;}finally{mobileSaving=false;if(button.isConnected)button.disabled=false;}};
}
async function archiveVehicle(id){const rec=mobileDoc.records[M.key('vehicles',id)];if(!rec)return;const active=rec.data.status==='Archiviert';if(!confirm(active?'Fahrzeug reaktivieren?':'Fahrzeug archivieren? Historie und Dateien bleiben erhalten.'))return;const next=M.clone(mobileDoc);next.records[M.key('vehicles',id)].data.status=active?'Aktiv':'Archiviert';next.records[M.key('vehicles',id)].data.updated_at=new Date().toISOString();await commitLocal(next);render();}
async function imageAsJpeg(file){const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('Bildformat kann nicht geöffnet werden. Bitte JPEG oder PNG wählen.'));img.src=url;});const scale=Math.min(1,2000/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(Error('Bild konnte nicht umgewandelt werden.')),'image/jpeg',0.88));}finally{URL.revokeObjectURL(url)}}
function addFileForm(vehicleId){mobileEditing=true;app.editing=true;inner(chrome(`<section class="panel"><h1>Foto oder Dokument hinzufügen</h1><p>Bilder werden als JPEG mit höchstens 2.000 Pixeln Kantenlänge gespeichert. Das Original im Fotoalbum bleibt unverändert. PDF/TXT/CSV werden unverändert übernommen (max. 20 MB).</p><form id="file-v2" class="editor-v2"><label>Foto aufnehmen<input type="file" id="camera-v2" accept="image/*" capture="environment"></label><label>Oder Datei / Foto auswählen<input type="file" id="file-select-v2" accept="image/*,.pdf,.txt,.csv"></label>${field('Titel (optional)','title')}${field('Diagnosefall (optional)','case_id','','select',[['','Nur dem Fahrzeug zuordnen'],...rows('cases').filter(c=>c.vehicle_id===vehicleId).map(c=>[c.id,c.description])])}${field('Notizen','notes','','textarea')}<p class="status" id="file-status-v2" hidden></p><div class="actions"><button type="submit" class="btn">Datei speichern</button><button type="button" class="btn secondary" id="cancel-file-v2">Abbrechen</button></div></form></section>`));$('cancel-file-v2').onclick=()=>{if(mobileSaving)return;mobileEditing=false;app.editing=false;render()};$('file-v2').onsubmit=async e=>{e.preventDefault();if(mobileSaving)return;const f=$('camera-v2').files[0]||$('file-select-v2').files[0];if(!f){setFileStatus('Bitte eine Datei auswählen.',true);return;}mobileSaving=true;const button=e.target.querySelector('button[type=submit]');button.disabled=true;try{if(f.size>20*1024*1024)throw Error('Ausgangsdatei größer als 20 MB.');setFileStatus('Datei wird vorbereitet …');let blob=f,name=f.name,ext='';const isImage=f.type.startsWith('image/')||/\.(heic|heif|png|jpe?g|webp)$/i.test(name);if(isImage){blob=await imageAsJpeg(f);name=name.replace(/\.[^.]+$/,'')+'.jpg';ext='jpg';}else{ext=name.split('.').pop().toLowerCase();if(!['pdf','txt','csv'].includes(ext))throw Error('Bitte PDF, TXT, CSV oder ein Foto auswählen.');const bytes=new Uint8Array(await f.slice(0,4096).arrayBuffer());if(ext==='pdf'&&new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Kein gültiger PDF-Dateianfang.');if(ext!=='pdf'&&bytes.includes(0))throw Error('Keine Textdatei.');blob=new Blob([f],{type:ext==='pdf'?'application/pdf':ext==='csv'?'text/csv':'text/plain'});}const form=new FormData(e.target),uid=crypto.randomUUID(),stored=crypto.randomUUID().replaceAll('-','')+'.'+ext;const data=M.defaults('attachments',{vehicle_id:vehicleId,case_id:form.get('case_id')||null,filename:name.slice(0,195),title:String(form.get('title')||''),notes:String(form.get('notes')||''),stored_name:stored,media_type:blob.type,size_bytes:blob.size,sha256:await M.hash(await blob.arrayBuffer())});const next=M.clone(mobileDoc);next.records[M.key('attachments',uid)]={entity:'attachments',uid,deleted:false,data};await commitLocal(next,[[stored,blob]]);mobileEditing=false;app.editing=false;setMessage('Datei lokal gespeichert. Automatischer Cloud-Abgleich folgt, sofern verbunden.');}catch(err){setFileStatus(err.message,true)}finally{mobileSaving=false;if(button.isConnected)button.disabled=false;}};
 function setFileStatus(s,bad=false){$('file-status-v2').hidden=false;$('file-status-v2').textContent=s;$('file-status-v2').className='status'+(bad?' bad':'');}
}
function showCaseReport(id){const c=rows('cases').find(c=>c.id===id),v=c&&veh(c.vehicle_id);if(!c||!v)return;const costs=rows('expenses').filter(e=>e.case_id===id),steps=rows('case_steps').filter(s=>s.case_id===id);inner(chrome(`<div class="actions report-toolbar"><button class="btn" id="print-v2">Drucken / PDF</button><button class="btn secondary" id="back-report-v2">Zurück</button><p class="small">Auf dem iPhone im Druckdialog die Vorschau öffnen und über Teilen in „Dateien“ sichern. Verfügbarkeit hängt von der iOS-Version ab.</p></div><article id="mobile-report"><p>MEINE FAHRZEUGWERKSTATT · PRIVATES PRÜFPROTOKOLL</p><h1>Diagnosebericht</h1>${details([['Fahrzeug',vehicleName(v)],['Baujahr',v.build_year],['Motor',v.engine],['Kennzeichen',v.plate],['Datum',c.date],['Kilometerstand',c.mileage],['Status',c.status],['Beanstandung',c.description],['Fehlercode',c.dtc_code],['Displaymeldung',c.display_message],['Prüfungen',c.checks],['Ursache',c.root_cause],['Reparatur / Ergebnis',c.resolution],['Notizen',c.notes]])}<h2>Prüfschritte</h2>${steps.map(s=>details([['Prüfung',s.title],['Stand',s.status],['Ergebnis',s.result]])).join('')||'<p>Keine Schritte dokumentiert.</p>'}<h2>Kosten</h2>${costs.map(e=>`<p>${esc(e.date)} · ${esc(e.description)} · ${(e.amount_cents/100).toFixed(2)} €</p>`).join('')}<b>Summe ${(costs.reduce((a,c)=>a+c.amount_cents,0)/100).toFixed(2)} €</b><p>Privates Dokumentationsprotokoll; keine Herstellerdiagnose oder amtliche Prüfung.</p></article>`));$('print-v2').onclick=()=>window.print();$('back-report-v2').onclick=render;}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000)}
async function backupV2(){const zip=new JSZip(),ctx=await mobileAdapter.read();const info={format:'FWMobileBackup',version:2,created_at:new Date().toISOString(),doc:ctx.doc,state:ctx.state,legacy_entries:await kvGet('meta','mobileEntries')||[]};zip.file('fw_mobile.json',JSON.stringify(info));for(const r of Object.values(ctx.doc.records)){if(r.entity!=='attachments'||r.deleted)continue;const b=await mobileAdapter.getBlob(r.data);if(!b)throw Error('Anhang fehlt: '+r.data.filename);zip.file('Anhaenge/'+r.data.stored_name,b);}const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});downloadBlob(blob,'Fahrzeugwerkstatt_Mobile_Vollsicherung_'+mobileDate()+'.zip');setMessage('Mobile Sicherung erstellt. In iCloud Drive oder Dateien aufbewahren. Sie enthält keine Anmeldedaten.');}
async function restoreV2(file){
 if(app.importBusy||mobileSaving||mobileEditing||window.fwCloud?.busy)throw Error('Aktuellen Vorgang oder Abgleich zuerst beenden.');
 app.importBusy=true;
 try{
  if(file.size>256*1024*1024)throw Error('Sicherung größer als 256 MB.');
  const original=await mobileAdapter.read();
  const z=await JSZip.loadAsync(file,{checkCRC32:true}),f=z.file('fw_mobile.json');
  if(!f)throw Error('Keine mobile Vollsicherung im unterstützten Format.');
  if((f._data?.uncompressedSize||0)>40*1024*1024)throw Error('Manifest zu groß.');
  const p=JSON.parse(await f.async('string'));
  if(p.format!=='FWMobileBackup'||p.version!==2)throw Error('Unbekanntes Sicherungsformat.');
  const restoredDoc=M.upgrade(p.doc);M.validate(restoredDoc);
  const files=[];let total=0;
  for(const r of Object.values(restoredDoc.records)){
   if(r.entity!=='attachments'||r.deleted)continue;
   const a=r.data,entry=z.file('Anhaenge/'+a.stored_name);
   if(!entry||(entry._data?.uncompressedSize||0)>20971520)throw Error('Anhang fehlt oder ist zu groß.');
   const bytes=await entry.async('uint8array');total+=bytes.byteLength;
   if(total>512*1024*1024)throw Error('Anhänge größer als 512 MB.');
   if(bytes.byteLength!==a.size_bytes||await M.hash(bytes)!==a.sha256)throw Error('Anhang beschädigt.');
   files.push([a.stored_name,new Blob([bytes],{type:a.media_type})]);
  }
  if(!confirm('Diesen mobilen Bestand ersetzen? Zuerst eigene aktuelle Vollsicherung speichern. Cloud wird pausiert; Windows und die Cloud werden jetzt nicht geändert.'))return;
  const state={...(p.state||{}),paused:true};
  for(const key of ['base','initial_base'])if(state[key])state[key]=M.upgrade(state[key]);
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['meta','files'],'readwrite'),store=tx.objectStore('meta');
   const check=store.get(LOCAL_DOC);
   check.onsuccess=()=>{
    if(!M.equal(check.result,original.doc)){tx.abort();return;}
    store.put({doc:check.result,state:original.state,created_at:new Date().toISOString()},'before_restore_v2');
    store.put(restoredDoc,LOCAL_DOC);store.put(state,SYNC_STATE);
    store.put(p.legacy_entries||[],'restored_legacy_entries');
    for(const [name,blob]of files)tx.objectStore('files').put(blob,name);
   };
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Daten inzwischen in einem anderen Fenster geändert. Wiederherstellung abgebrochen; nichts überschrieben.'));
  });
  mobileDoc=restoredDoc;window.fwCloud?.stop();normalizeView();app.selected=null;app.page='more';
  setMessage('Wiederhergestellt. Cloud-Abgleich ist zur Prüfung pausiert.');
 }finally{app.importBusy=false;}
}

const mobileAdapter={
 primary:false,
 async read(){
  const snapshot=await new Promise((resolve,reject)=>{
   const tx=db.transaction('meta','readonly'),store=tx.objectStore('meta');
   const doc=store.get(LOCAL_DOC),state=store.get(SYNC_STATE);
   tx.oncomplete=()=>resolve({doc:doc.result||M.empty(),state:state.result||{}});
   tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Lokaler Datenstand konnte nicht gelesen werden.'));
  });
  return {...snapshot,hash:await M.signature(snapshot.doc)};
 },
 saveState:state=>kvPut('meta',SYNC_STATE,state),
 async apply(expected,doc,state){
  if(mobileEditing||mobileSaving)throw Error('Eingabe aktiv. Datenstand später vergleichen.');
  const inert=document.body.inert;document.body.inert=true;
  try{
   M.validate(doc);const check=await mobileAdapter.read();
   if(check.state.paused)throw Error('Abgleich nach Wiederherstellung pausiert. Erst den Datenstand prüfen.');
   if(check.hash!==expected)throw Error('Lokal inzwischen geändert. Nichts überschrieben.');
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('meta','readwrite'),store=tx.objectStore('meta'),get=store.get(LOCAL_DOC);
    let abortMessage='Lokale Änderung erkannt. Abgleich neu prüfen.';
    get.onsuccess=()=>{
     if(!M.equal(get.result,check.doc)){tx.abort();return;}
     const currentState=store.get(SYNC_STATE);
     currentState.onsuccess=()=>{
      const value=currentState.result||{};
      if(value.paused){abortMessage='Abgleich nach Wiederherstellung pausiert. Erst den Datenstand prüfen.';tx.abort();return;}
      if(!M.equal(value,check.state)){abortMessage='Abgleichstatus inzwischen in einem anderen Fenster geändert. Nichts überschrieben.';tx.abort();return;}
      if(!M.equal(get.result,doc))store.put({doc:get.result,state:value},'before_cloud_apply_v2');
      store.put(doc,LOCAL_DOC);store.put(state,SYNC_STATE);
     };
    };
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error(abortMessage));
   });
   mobileDoc=doc;normalizeView();if(!mobileEditing&&app.page!=='cloud')render();
  }finally{document.body.inert=inert;}
 },
 async getBlob(data){const b=await kvGet('files',data.stored_name);if(!b)return null;if(b.size!==data.size_bytes||await M.hash(await b.arrayBuffer())!==data.sha256)throw Error('Lokaler Anhang beschädigt: '+data.filename);return b;},
 putBlob:(data,blob)=>kvPut('files',data.stored_name,blob),
 saveSession:()=>{}
};
bind=function(){oldBind();if($('mobile-update-apply'))$('mobile-update-apply').onclick=applyMobileUpdate;document.querySelectorAll('[data-edit-entity]').forEach(e=>e.onclick=()=>openEditor(e.dataset.editEntity,e.dataset.editId||null,e.dataset.parentVehicle||app.selected,e.dataset.parentCase));document.querySelectorAll('[data-archive]').forEach(e=>e.onclick=()=>archiveVehicle(e.dataset.archive).catch(x=>setMessage(x.message,true)));document.querySelectorAll('[data-add-file]').forEach(e=>e.onclick=()=>addFileForm(e.dataset.addFile));document.querySelectorAll('[data-report-case]').forEach(e=>e.onclick=()=>showCaseReport(e.dataset.reportCase));if($('backup-mobile-v2'))$('backup-mobile-v2').onclick=()=>backupV2().catch(e=>setMessage(e.message,true));if($('restore-mobile-v2'))$('restore-mobile-v2').onchange=e=>{if(e.target.files[0])restoreV2(e.target.files[0]).catch(e=>setMessage(e.message,true))};if($('export-old-notes'))$('export-old-notes').onclick=async()=>downloadBlob(new Blob([JSON.stringify(await kvGet('meta','mobileEntries')||[],null,2)],{type:'application/json'}),'Mobile_02_Originalnotizen.json');};
// Protect form data from navigation; direct DOM injection from remote values is escaped.
document.addEventListener('click',e=>{if(!e.target.closest('[data-nav],[data-back],[data-vehicle],[data-tab],[data-fw21-nav]'))return;if(mobileSaving||mobileUpdating){e.stopImmediatePropagation();e.preventDefault();return;}if(!mobileEditing)return;if(!confirm('Ungespeicherte Eingaben verwerfen?')){e.stopImmediatePropagation();e.preventDefault();return;}mobileEditing=false;app.editing=false;},true);
window.addEventListener('beforeunload',e=>{if(mobileEditing){e.preventDefault();e.returnValue='';}});
async function mobileStartV2(){
 try{
  db=await openDb();mobileDoc=await migrate02();normalizeView();
  const engine=new FWCloud.Engine(mobileAdapter,{primary:false,isEditing:()=>mobileEditing||mobileSaving||mobileUpdating||app.importBusy,notify:s=>{
   document.querySelectorAll('[data-mobile-sync-strip]').forEach(e=>{e.textContent='⇄ '+s.text;e.className='sync-strip '+s.kind;});
   document.querySelectorAll('[data-cloud-inline]').forEach(e=>{e.textContent=s.text;e.className='cloud-state '+s.kind;});
   if(s.kind==='conflict'&&app.page==='cloud'&&!mobileEditing&&!document.activeElement?.closest('[data-cloud-form]'))render();
  }});
  window.fwCloud=engine;mobileSyncUI=FWSyncUI.create(engine,mobileAdapter,()=>{if(app.page==='cloud'&&!mobileEditing)render()});
  render();await mobileSyncUI.start();
  window.addEventListener('online',()=>engine.schedule(500));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)engine.schedule(500)});
  window.addEventListener('pageshow',()=>engine.schedule(1000));
  registerMobileWorker().catch(()=>{if(!mobileEditing)setMessage('Die Offline-Aktualisierung konnte noch nicht abgeschlossen werden. Bei Internetverbindung erneut öffnen.',true);});
 }catch(e){
  $('root').innerHTML='<main class="shell"><h1>Datenstart angehalten</h1><p>'+esc(e.message)+'</p><p>Die bisherigen Daten sind nicht gelöscht. Bitte die Fehlermeldung weitergeben; keine App-Daten löschen.</p></main>';console.error(e);
 }
}

const originalPersist01=persist;
persist=async function(payload,files){
 const ctx=await mobileAdapter.read();
 if(ctx.state.binding||M.changedCount(ctx.state.initial_base||M.empty(),ctx.doc)>0)throw Error('Es gibt eigene Änderungen oder einen Cloud-Abgleich. Einen Windows-Export jetzt nicht darüberkopieren. Bitte Cloud verwenden oder zuerst mobile Vollsicherung erstellen.');
 const next=M.upgrade(M.fromPortable(payload));M.validate(next);
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(['meta','files'],'readwrite'),store=tx.objectStore('meta');
  const check=store.get(LOCAL_DOC);
  check.onsuccess=()=>{
   if(!M.equal(check.result,ctx.doc)){tx.abort();return;}
   const state=store.get(SYNC_STATE);
   state.onsuccess=()=>{
    if(!M.equal(state.result||{},ctx.state)){tx.abort();return;}
    store.put({doc:check.result,state:state.result,created_at:new Date().toISOString()},'before_portable_import_v2');
    store.put(payload,'snapshot');store.put(next,LOCAL_DOC);store.put({initial_base:M.clone(next),revision:0},SYNC_STATE);
    for(const [name,blob]of files.entries())tx.objectStore('files').put(blob,name);
   };
  };
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Daten inzwischen geändert. Import abgebrochen; nichts überschrieben.'));
 });
 mobileDoc=next;normalizeView();
};

refresh=function(){if(mobileDoc)normalizeView();render();};
