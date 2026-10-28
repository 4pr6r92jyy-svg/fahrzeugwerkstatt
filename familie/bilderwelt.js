(() => { 'use strict';
const gallery=document.getElementById('world-gallery'), dialog=document.getElementById('world-lightbox'), full=dialog.querySelector('img');
// Ausschließlich Dateipfade aus der lokalen Bilderliste; keine externen Bildadressen.
const safe=(p)=>typeof p==='string' && /^assets\/bilderwelt\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|gif)$/i.test(p) && !p.includes('..');
(async()=>{try{const r=await fetch('bilderwelt.json',{cache:'no-store'});if(!r.ok)throw Error('Die Bilderliste ist nicht erreichbar.');const data=await r.json();const paths=(Array.isArray(data.bilder)?data.bilder:[]).filter(safe);gallery.replaceChildren();if(!paths.length){gallery.textContent='Noch keine Bilder vorhanden.';return;}
for(const [i,path] of paths.entries()){const btn=document.createElement('button');btn.type='button';btn.className='world-image';btn.setAttribute('aria-label',`Bild ${i+1} groß ansehen`);const img=document.createElement('img');img.src=path;img.loading=i<2?'eager':'lazy';img.alt=`Bilderwelt – Bild ${i+1}`;btn.append(img);btn.addEventListener('click',()=>{full.src=path;full.alt=img.alt;dialog.showModal();});gallery.append(btn);}}
catch(e){gallery.textContent='Bilder konnten nicht geladen werden. Bitte die GitHub-Veröffentlichung und bilderwelt.json prüfen.';}})();
document.getElementById('world-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{full.removeAttribute('src');});
})();