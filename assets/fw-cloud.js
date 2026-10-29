/* Fahrzeugwerkstatt 2.1 – explicit opt-in cloud, offline local-first.
   Transport: Supabase Auth + transactional Postgres RPC + private Storage.
   Session credentials are NEVER included in a vehicle export or backup. */
(function(root){'use strict';const M=root.FWModel||(typeof require!=='undefined'?require('./fw-model.js'):null);
function checkConfig(c){if(!c||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.url))throw Error('Bitte die Projekt-URL https://…supabase.co ohne Pfad eintragen.');if(!c.key||c.key.startsWith('sb_secret_'))throw Error('Nur Publishable Key oder anon-Key verwenden – niemals einen Secret-/service_role-Schlüssel.');if(c.key.startsWith('ey')){try{const p=JSON.parse(atob(c.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(p.role!=='anon')throw Error('role');}catch{throw Error('Kein gültiger öffentlicher anon-Schlüssel.')}}else if(!c.key.startsWith('sb_publishable_'))throw Error('Öffentlicher Projektschlüssel nicht erkannt.');return {url:c.url,key:c.key};}
class SupabaseTransport{
 constructor(config,session,onSession=()=>{}){this.config=checkConfig(config);this.session=session||null;this.onSession=onSession;this.refreshing=null;}
 async raw(path,options={},authenticated=true,retry=true){const headers={apikey:this.config.key,...options.headers};if(authenticated){if(!this.session)throw Error('Bitte zuerst anmelden.');if(Number(this.session.expires_at||0)*1000<Date.now()+60000)await this.renew();headers.Authorization='Bearer '+this.session.access_token;}
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),45000);let res;try{res=await fetch(this.config.url+path,{...options,headers,signal:abort.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});}catch(e){throw Error(e.name==='AbortError'?'Cloud antwortet nicht rechtzeitig. Lokale Daten bleiben gespeichert.':'Keine Cloud-Verbindung. Lokale Änderungen bleiben gespeichert.');}finally{clearTimeout(timer)}
  if(res.status===401&&authenticated&&retry){await this.renew();return this.raw(path,options,true,false)}return res;}
 async json(path,body,authenticated=true){const res=await this.raw(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},authenticated);let x;try{x=await res.json()}catch{throw Error('Cloud lieferte keine gültige Antwort.')}if(!res.ok)throw Error(x.msg||x.message||x.error_description||x.error||('Cloud-Fehler '+res.status));return x;}
 async login(email,password){const s=await this.json('/auth/v1/token?grant_type=password',{email,password},false);if(!s.access_token||!s.refresh_token||!s.user?.id)throw Error('Anmeldung unvollständig.');s.expires_at=s.expires_at||Math.floor(Date.now()/1000)+s.expires_in;this.session=s;await this.onSession(s);await this.head();return s;}
 async renew(){if(this.refreshing)return this.refreshing;if(!this.session?.refresh_token)throw Error('Bitte erneut anmelden; lokale Daten bleiben erhalten.');this.refreshing=(async()=>{const s=await this.json('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token},false);if(!s.access_token)throw Error('Anmeldung erneuern.');s.expires_at=s.expires_at||Math.floor(Date.now()/1000)+s.expires_in;this.session=s;await this.onSession(s);})().finally(()=>this.refreshing=null);return this.refreshing;}
 async logout(){try{if(this.session)await this.raw('/auth/v1/logout?scope=local',{method:'POST'})}finally{this.session=null;await this.onSession(null)}}
 head(){return this.json('/rest/v1/rpc/fw_head',{})} read(){return this.json('/rest/v1/rpc/fw_read',{})}save(revision,doc){return this.json('/rest/v1/rpc/fw_save',{expected_revision:revision,data_document:doc})}
 path(data){return this.session.user.id+'/'+data.sha256+'.'+data.stored_name.split('.').pop()}
 async upload(data,blob){if(blob.size!==data.size_bytes||await M.hash(await blob.arrayBuffer())!==data.sha256)throw Error('Lokaler Dateianhang beschädigt: '+data.filename);const path=this.path(data),res=await this.raw('/storage/v1/object/fw-files/'+path,{method:'POST',headers:{'Content-Type':data.media_type,'x-upsert':'false'},body:blob});if(!res.ok){const msg=await res.json().catch(()=>({}));if([400,409].includes(res.status)&&/exist|duplicat/i.test(msg.message||msg.error||'')){const existing=await this.download(data);if(existing.size===blob.size)return;}throw Error('Datei nicht in die private Cloud übertragen: '+(msg.message||res.status));}}
 async download(data){const res=await this.raw('/storage/v1/object/authenticated/fw-files/'+this.path(data));if(!res.ok)throw Error('Cloud-Anhang fehlt oder ist nicht freigegeben: '+data.filename);if(Number(res.headers.get('Content-Length'))>20971520)throw Error('Cloud-Datei überschreitet 20 MB.');const blob=await res.blob();if(blob.size!==data.size_bytes||await M.hash(await blob.arrayBuffer())!==data.sha256)throw Error('Prüfsumme der Cloud-Datei stimmt nicht: '+data.filename);return new Blob([blob],{type:data.media_type});}
}
class Engine{
 constructor(adapter,options={}){this.adapter=adapter;this.transport=options.transport||null;this.notify=options.notify||(()=>{});this.isEditing=options.isEditing||(()=>false);this.primary=!!options.primary;this.busy=false;this.conflicts=[];this.lastDoc=null;this.lastStatus={text:'Cloud nicht eingerichtet',kind:'off',pending:0};this.config=null;this.lastError='';this.timer=null;this.choices={};}
 status(text,kind='info',pending=0){this.lastStatus={text,kind,pending};this.notify(this.lastStatus)}
 async connect(config,session){this.config=config;if(!this.transport)this.transport=new SupabaseTransport(config,session,s=>this.adapter.saveSession(s));if(!this.transport.session&&!this.transport.testMode){this.status('Bitte anmelden','off');return;}this.start();}
 start(){clearInterval(this.timer);this.timer=setInterval(()=>this.sync().catch(()=>{}),300000);this.schedule(400);}
 stop(){clearInterval(this.timer);clearTimeout(this.debounce);this.timer=null;this.config=null;this.status('Automatischer Abgleich pausiert','off');}
 schedule(ms=2000){clearTimeout(this.debounce);this.debounce=setTimeout(()=>this.sync().catch(()=>{}),ms);}
 async sync(force=false){if(!this.config?.enabled||!this.transport)return;if(this.busy)return;if(typeof navigator!=='undefined'&&navigator.onLine===false){const ctx=await this.adapter.read();this.status('Offline · Änderungen bleiben lokal','waiting',M.changedCount(ctx.state.base||ctx.state.initial_base,ctx.doc));return;}
  if(this.isEditing()){this.status('Eingabe aktiv · Abgleich nach dem Speichern','waiting');return;}
  const work=async()=>{this.busy=true;try{await this.run(force)}catch(e){this.lastError=e.message;this.status(e.message,'error');}finally{this.busy=false}};
  if(typeof navigator!=='undefined'&&navigator.locks){await navigator.locks.request('fw-cloud-v2',{ifAvailable:true},lock=>lock?work():Promise.resolve());}else{ // fallback lease for browsers without Web Locks; data CAS remains the final guard.
   const key='fw-cloud-lease',token=crypto.randomUUID();let old;try{old=JSON.parse(localStorage.getItem(key)||'null');if(old&&old.until>Date.now())return;localStorage.setItem(key,JSON.stringify({token,until:Date.now()+120000}));}catch{}const beat=setInterval(()=>{try{localStorage.setItem(key,JSON.stringify({token,until:Date.now()+120000}))}catch{}},20000);try{await work()}finally{clearInterval(beat);try{if(JSON.parse(localStorage.getItem(key)||'{}').token===token)localStorage.removeItem(key)}catch{}}}
 }
 async run(force=false){const runConfig=this.config,transport=this.transport;const active=()=>this.config===runConfig&&this.transport===transport&&!!runConfig?.enabled;if(!active())return;this.status('Abgleich wird geprüft …','busy');const ctx=await this.adapter.read();if(!active())return;M.validate(ctx.doc);const binding=runConfig.url+'|'+(this.transport.session?.user?.id||'test');if(ctx.state.binding&&ctx.state.binding!==binding)throw Error('Dieser Datenbestand ist an ein anderes Cloud-Konto gebunden. Nicht zusammenführen.');
  if(ctx.state.paused)throw Error('Abgleich nach Wiederherstellung pausiert. Erst Sicherung und Datenstände prüfen.');
  let head=await this.transport.head(),remote=null,revision=head.revision;
  if(revision===0){if(!this.primary||!this.config.allowCreate)throw Error('Die Cloud ist noch leer. Zuerst am Surface anmelden und den Erstabgleich bestätigen.');remote=M.empty(ctx.doc.dataset_id);}
  else if(ctx.state.client_schema===23&&ctx.state.revision===revision&&ctx.state.base)remote=M.clone(ctx.state.base);
  else {const fetched=await this.transport.read();revision=fetched.revision;remote=fetched.document;}
  if(!active())return;if(!remote)throw Error('Cloud-Datenbestand fehlt.');M.validate(remote);const remoteWire=M.clone(remote);remote=M.upgrade(remote);
  if(ctx.state.client_schema===23&&ctx.state.binding===binding&&ctx.state.revision===revision&&ctx.state.base&&M.equal(ctx.doc,ctx.state.base)&&M.equal(ctx.doc,M.upgrade(ctx.doc))&&!force){this.status('Alles synchronisiert · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),'ok');return;}
  const local=M.upgrade(ctx.doc);if(local.dataset_id&&remote.dataset_id&&local.dataset_id!==remote.dataset_id)throw Error('Diese Daten gehören zu einem anderen Fahrzeugbestand. Kein automatisches Überschreiben.');
  local.dataset_id=remote.dataset_id||local.dataset_id;
  if(!local.dataset_id)throw Error('Datenbestandskennung fehlt.');
  let base=M.upgrade(ctx.state.base||ctx.state.initial_base||M.empty(local.dataset_id));base.dataset_id=local.dataset_id;
  if(!ctx.state.binding&&revision>0&&Object.keys(local.records).length){const overlap=Object.keys(local.records).some(k=>remote.records[k]);if(!overlap)throw Error('Keine gemeinsamen Kennungen gefunden. Bitte zuerst einen mobilen Export derselben Windows-Datenbank übernehmen.');}
  const choices={...(ctx.state.choices||{}),...this.choices};const plan=M.merge(base,local,remote,choices);this.lastDoc=local;
  if(plan.conflicts.length){this.conflicts=plan.conflicts;await this.adapter.saveState({...ctx.state,conflicts:plan.conflicts,choices});this.status(plan.conflicts.length+' Konflikt(e) prüfen · nichts überschrieben','conflict',plan.conflicts.length);return;}
  M.validate(plan.doc);this.conflicts=[];
  const pending=M.changedCount(base,local);this.status('Dateien und Änderungen abgleichen …','busy',pending);
  // Files must exist before their metadata is made visible on another device.
  for(const [k,r]of Object.entries(plan.doc.records)){if(!active())return;if(r.entity!=='attachments'||r.deleted)continue;const data=r.data,known=remote.records[k];let blob=await this.adapter.getBlob(data);
   if(!active())return;if(!blob){blob=await this.transport.download(data);if(!active())return;await this.adapter.putBlob(data,blob);}
   if(!active())return;if(!known||known.deleted||known.data.sha256!==data.sha256)await this.transport.upload(data,blob);
  }
  if(!active())return;if(this.isEditing()){this.status('Eingabe aktiv · Abgleich nach dem Speichern','waiting');this.schedule(2000);return;}
  if(!M.equal(plan.doc,remoteWire)){const written=await this.transport.save(revision,plan.doc);if(!written.ok){this.status('Anderes Gerät hat gespeichert · erneuter Vergleich','waiting');this.schedule(1000);return;}revision=written.revision;remote=M.clone(plan.doc);}
  const nextState={base:remote,revision,binding,client_schema:23,last_sync:new Date().toISOString(),choices:{},conflicts:[],paused:false};
  // The adapter checks ctx.hash in one transaction. Never clobber local edits made
  // while network requests were in flight. The next run re-evaluates against base.
  if(!active())return;if(this.isEditing()){this.status('Eingabe aktiv · Datenstand später übernehmen','waiting');this.schedule(2000);return;}
  await this.adapter.apply(ctx.hash,plan.doc,nextState);this.choices={};this.lastError='';if(!active())return;
  this.status('Alles synchronisiert · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),'ok');
 }
 async choose(key,side){const c=this.conflicts.find(x=>x.key===key);if(!c||!['local','remote'].includes(side))throw Error('Konflikt nicht mehr aktuell.');const ctx=await this.adapter.read();const choice={side,mark:c.mark};this.choices[key]=choice;await this.adapter.saveState({...ctx.state,choices:{...(ctx.state.choices||{}),[key]:choice}});this.conflicts=this.conflicts.filter(x=>x.key!==key);this.status(this.conflicts.length?'Weitere Konflikte auswählen':'Auswahl gespeichert · Abgleich wird erneut geprüft',this.conflicts.length?'conflict':'waiting');if(!this.conflicts.length)this.schedule(300);}
}
root.FWCloud={Engine,SupabaseTransport,checkConfig};if(typeof module!=='undefined'&&module.exports)module.exports=root.FWCloud;
})(typeof globalThis!=='undefined'?globalThis:this);
