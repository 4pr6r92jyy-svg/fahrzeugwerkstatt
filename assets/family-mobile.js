/* iPhone: Familienmeldungen über „Mehr“ in den privaten App-Bereich einbinden. */
(function(){'use strict';const oldMore=more;more=function(){return `<section class="panel"><h2>📣 Was klappert denn da?</h2><p>Freigegebene Familienfahrzeuge und eingegangene Meldungen verwalten.</p><button class="btn orange" data-nav="family">Familienmeldungen öffnen</button></section>`+oldMore()};
const oldVehicleDetails=vehicleDetails;vehicleDetails=function(v){return oldVehicleDetails(v)+(v?.id?FWFamilyAdmin.vehicleCard(v.id):'')};
const oldRender=render;render=function(){if(app.page==='family'){inner(chrome(FWFamilyAdmin.render()));return}return oldRender()};
document.addEventListener('click',e=>{if(e.target.closest('[data-nav="family"]'))setTimeout(()=>FWFamilyAdmin.load(),0)});
})();