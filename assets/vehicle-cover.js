/* Vehicle cover photos – Mobile 2.0.1: reuses notes marker, canonical attachments and IndexedDB blobs. */
(function(){'use strict';
const COVER='[[FW_COVER_V1]]';
const photo=a=>a&&String(a.media_type||'').startsWith('image/');
const hasCover=a=>String(a?.notes||'').startsWith(COVER);
const clean=notes=>String(notes||'').replace(/^\[\[FW_COVER_V1\]\]\n?/, '');
const cover=id=>rows('attachments').filter(a=>String(a.vehicle_id)===String(id)&&photo(a)&&hasCover(a)).sort((a,b)=>String(b.id).localeCompare(String(a.id)))[0];
const thumb=(a,type)=>`<button type="button" class="${type}" data-cover-open="${esc(a.stored_name)}" aria-label="${esc(a.title||a.filename)} groß ansehen"><img alt="${esc(a.title||a.filename)}" data-cover-img="${esc(a.stored_name)}"></button>`;
const oldList=vehicleList;
vehicleList=function(){return oldList().replace(/<article class="item" data-vehicle="([^"]+)">/g,(match,id)=>{const a=cover(id);return a?match+thumb(a,'mobile-cover-small'):match;});};
const oldDetail=vehicleDetails;
vehicleDetails=function(v){let html=oldDetail(v);const a=cover(v.id);if(a){html=html.replace(/(<h1>[\s\S]*?<\/h1><p class="muted">[\s\S]*?<\/p>)/,`<div class="mobile-cover-heading"><div>$1</div>${thumb(a,'mobile-cover-large')}</div>`);}
 return html;
};
const oldFileCard=fileCard;
fileCard=function(a){let html=oldFileCard(a);if(!photo(a))return html;const selected=hasCover(a);return html+`<div class="mobile-cover-choice"><button type="button" data-cover-select="${esc(a.stored_name)}" class="btn secondary">${selected?'✓ Titelbild entfernen':'☆ Als Titelbild verwenden'}</button></div>`;};
let busyCover=false;
async function selectCover(name){if(busyCover)return;const a=rows('attachments').find(x=>x.stored_name===name);if(!photo(a))return;busyCover=true;try{const next=M.clone(mobileDoc),selected=!hasCover(a);
 for(const r of Object.values(next.records)){if(r.entity!=='attachments'||r.deleted||String(r.data.vehicle_id)!==String(a.vehicle_id)||!photo(r.data))continue;
 r.data.notes=clean(r.data.notes);
 if(r.data.stored_name===name&&selected)r.data.notes=COVER+'\n'+r.data.notes;
 }
 await commitLocal(next);setMessage(selected?'Fahrzeugbild ausgewählt; wird synchronisiert.':'Fahrzeugbild entfernt.');
 }catch(err){setMessage('Titelbild konnte nicht gespeichert werden: '+err.message,true)}finally{busyCover=false;}}
let imageURLs=[];
function dispose(){for(const u of imageURLs)URL.revokeObjectURL(u);imageURLs=[];}
const oldBindCover=bind;
bind=function(){dispose();oldBindCover();document.querySelectorAll('img[data-cover-img]').forEach(async img=>{const name=img.dataset.coverImg;try{const blob=await kvGet('files',name);if(!blob||!img.isConnected)return;const url=URL.createObjectURL(blob);imageURLs.push(url);img.src=url;img.parentElement.hidden=false;}catch(e){console.warn('Fahrzeugbild nicht verfügbar',e);}});};
// Hide photo buttons until actual local image is loaded, no noticeable blank frame.
const coverOpenOriginal=document.addEventListener.bind(document);
// Capture: ensures tapping the picture never opens the vehicle instead.
document.addEventListener('click',async e=>{const choose=e.target.closest('[data-cover-select]');if(choose){e.preventDefault();e.stopImmediatePropagation();await selectCover(choose.dataset.coverSelect);return;}
 const picture=e.target.closest('[data-cover-open]');if(!picture)return;e.preventDefault();e.stopImmediatePropagation();const name=picture.dataset.coverOpen;
 try{const blob=await kvGet('files',name);if(!blob)throw Error('Bild ist auf diesem Gerät noch nicht gespeichert. App später erneut synchronisieren.');const url=URL.createObjectURL(blob);const modal=document.createElement('div');modal.className='mobile-cover-overlay';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.innerHTML=`<button type="button" class="mobile-cover-close" aria-label="Großansicht schließen">✕</button><img alt="Fahrzeugbild in Großansicht">`;modal.querySelector('img').src=url;const close=()=>{modal.remove();URL.revokeObjectURL(url);document.removeEventListener('keydown',keyHandler)};const keyHandler=ev=>{if(ev.key==='Escape')close()};modal.addEventListener('click',ev=>{if(ev.target===modal||ev.target.closest('.mobile-cover-close'))close()});document.addEventListener('keydown',keyHandler);document.body.appendChild(modal);modal.querySelector('button').focus();}catch(err){setMessage(err.message,true);}
},true);
})();
