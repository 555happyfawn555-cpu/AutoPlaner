// АвтоПлан — каталог запчастей 2.6.1.
// Бесплатный режим: FAPI demo API + локальный словарь синонимов.
// Платный Laximo остаётся необязательным резервным провайдером.

const PARTS_PROVIDER=process.env.PARTS_PROVIDER||'free';
const LAXIMO_URL=process.env.LAXIMO_URL||'https://ws.laximo.ru/restApi/v1';
const LAXIMO_USER=process.env.LAXIMO_USER||'';
const LAXIMO_PASSWORD=process.env.LAXIMO_PASSWORD||'';
const FAPI_URL=process.env.FAPI_URL||'https://fapi.iisis.ru/fapi/v2/';
const FAPI_DEMO_KEY_URL=process.env.FAPI_DEMO_KEY_URL||'https://gist.githubusercontent.com/serp83/652d191745773ef6d8b5a0a689479cd6/raw/demo-key.txt';
let cachedFapiKey=''; let fapiKeyAt=0;
const freeTreeCache=new Map(); const freeProductsCache=new Map();

function laximoConfigured(){return !!LAXIMO_USER&&!!LAXIMO_PASSWORD}
function escQ(v){return encodeURIComponent(String(v??''))}
async function laximo(path, params={}){
  if(!laximoConfigured()) throw new Error('parts_provider_not_configured');
  const u=new URL(path.replace(/^\//,''),LAXIMO_URL.endsWith('/')?LAXIMO_URL:LAXIMO_URL+'/');
  for(const [k,v] of Object.entries(params)) if(v!==undefined&&v!==null&&v!=='') u.searchParams.set(k,String(v));
  const auth=Buffer.from(`${LAXIMO_USER}:${LAXIMO_PASSWORD}`).toString('base64');
  const r=await fetch(u,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Accept-Language':'ru_RU',accept:'application/json'}});
  const text=await r.text(); if(!r.ok) throw new Error(`parts_provider_http_${r.status}`);
  try{return JSON.parse(text)}catch{throw new Error('parts_provider_invalid_json')}
}

async function fapiKey(){
  if(process.env.FAPI_API_KEY) return process.env.FAPI_API_KEY;
  if(cachedFapiKey && Date.now()-fapiKeyAt<6*60*60*1000) return cachedFapiKey;
  const r=await fetch(FAPI_DEMO_KEY_URL); if(!r.ok) throw new Error('free_parts_demo_key_unavailable');
  const key=(await r.text()).trim(); if(!key) throw new Error('free_parts_demo_key_empty');
  cachedFapiKey=key; fapiKeyAt=Date.now(); return key;
}
async function fapi(path, params={}){
  const key=await fapiKey();
  const u=new URL(path.replace(/^\//,''),FAPI_URL.endsWith('/')?FAPI_URL:FAPI_URL+'/');
  for(const [k,v] of Object.entries(params)) if(v!==undefined&&v!==null&&v!=='') u.searchParams.set(k,String(v));
  const r=await fetch(u,{headers:{accept:'application/json',Authorization:`Bearer ${key}`}}); const text=await r.text();
  if(!r.ok) throw new Error(`free_parts_http_${r.status}`);
  try{return JSON.parse(text)}catch{throw new Error('free_parts_invalid_json')}
}

function arr(v){return Array.isArray(v)?v:(v?Object.values(v):[])}
function attrsToObject(a){const o={};for(const x of arr(a)) if(x?.key)o[x.key]=x.value;return o}
function norm(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[()\[\],.:;_/\\-]+/g,' ').replace(/\s+/g,' ').trim()}
function normalizeVehicle(x){return {catalog:x.catalog||'free',brand:x.brand||'',name:x.name||'',vehicleId:String(x.vehicleId??''),ssd:x.ssd||'',attributes:attrsToObject(x.attributes),raw:x}}
function normalizeUnit(x){return {unitId:String(x.unitId??x.unitid??''),name:x.name||'',code:x.code||'',ssd:x.ssd||'',imageUrl:(x.imageUrl||x.imageurl||'').replace('%size%','250'),largeImageUrl:(x.largeImageUrl||x.largeimageurl||'').replace('%size%','source'),filter:x.filter||null,attributes:attrsToObject(x.attributes),details:arr(x.details)}}
function normalizeDetail(x){return {name:x.name||'',oem:x.oem||'',codeOnImage:x.codeOnImage||x.codeonimage||'',ssd:x.ssd||'',filter:x.filter||null,attributes:attrsToObject(x.attributes),note:x.note||''}}

// Пользовательские названия -> термины, которые чаще встречаются в каталогах.
const PART_SYNONYMS={
  'ступичный подшипник':['wheel bearing','hub bearing','wheel hub','bearing hub','wheel'],
  'подшипник ступицы':['wheel bearing','hub bearing','wheel hub','bearing hub','wheel'],
  'подшипник переднего колеса':['front wheel bearing','front hub bearing','wheel bearing','wheel hub'],
  'подшипник заднего колеса':['rear wheel bearing','rear hub bearing','wheel bearing','wheel hub'],
  'передний ступичный подшипник':['front wheel bearing','front hub bearing','wheel bearing'],
  'задний ступичный подшипник':['rear wheel bearing','rear hub bearing','wheel bearing'],
  'тормозные колодки':['brake pad','brake pads','disc brake'],
  'колодки':['brake pad','brake pads'],
  'масляный фильтр':['oil filter'],
  'воздушный фильтр':['air filter'],
  'салонный фильтр':['cabin filter','pollen filter','interior filter'],
  'фильтр салона':['cabin filter','pollen filter','interior filter'],
  'топливный фильтр':['fuel filter'],
  'ремень грм':['timing belt','camshaft drive'],
  'цепь грм':['timing chain','camshaft drive'],
  'стойка стабилизатора':['stabilizer link','sway bar link','anti roll bar link'],
  'линк стабилизатора':['stabilizer link','sway bar link'],
  'шаровая опора':['ball joint','ball bearing joint'],
  'сайлентблок':['control arm bush','bushing','wishbone bush'],
  'рычаг':['control arm','wishbone','suspension arm'],
  'амортизатор':['shock absorber','damper','strut'],
  'стойка амортизатора':['shock absorber','strut','suspension strut'],
  'тормозной диск':['brake disc','brake rotor'],
  'диск тормозной':['brake disc','brake rotor'],
  'наружный шрус':['cv joint','outer cv joint','drive shaft joint'],
  'внутренний шрус':['inner cv joint','cv joint'],
  'шрус':['cv joint','drive shaft joint'],
  'ступица':['wheel hub','hub'],
  'генератор':['alternator'],
  'стартер':['starter motor','starter'],
  'свечи':['spark plug'],
  'свеча зажигания':['spark plug'],
  'термостат':['thermostat'],
  'помпа':['water pump'],
  'водяной насос':['water pump'],
  'приводной ремень':['drive belt','serpentine belt','accessory belt'],
  'поликлиновый ремень':['serpentine belt','drive belt'],
  'подшипник генератора':['alternator bearing'],
};
function expandQuery(q){
  const n=norm(q); const out=[n];
  for(const [k,v] of Object.entries(PART_SYNONYMS)) if(n===k || n.includes(k)) out.push(...v.map(norm));
  if(n.includes('задн')) out.push('rear'); if(n.includes('передн')) out.push('front');
  return [...new Set(out.filter(Boolean))];
}
function scoreText(text,terms){const t=norm(text);let score=0;for(const x of terms){if(t.includes(x))score+=x.length>4?3:1}return score}

export async function freeManufacturers(){const d=await fapi('/catalogList/dt/manufacturerList');return arr(d?.mf)}
export async function freeModels(mfi){const d=await fapi('/catalogList/dt/modelList',{mfi});return arr(d?.m)}
export async function freeModifications(mdi){const d=await fapi('/catalogList/dt/modificationList',{mi:mdi});return arr(d?.m)}
function chooseByText(rows, wanted){const w=norm(wanted);if(!w)return rows[0];return rows.map(x=>({x,s:scoreText(`${x.d||''} ${x.fd||''}`,[w])})).sort((a,b)=>b.s-a.s)[0]?.x}
function dateYear(ms){if(!ms)return null;const y=new Date(Number(ms)).getUTCFullYear();return Number.isFinite(y)?y:null}
export async function freeVinVehicle(vin){
  const clean=String(vin||'').trim().toUpperCase();
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) throw new Error('invalid_vin');
  const d=await fapi('/vin',{vin:clean});
  const x=d?.vehicle||d;
  if(!x || !(x.make||x.brand||x.model||x.name)) throw new Error('vin_vehicle_not_found');
  return {catalog:'free',brand:x.make||x.brand||'',name:x.model||x.name||'',vehicleId:String(x.dt_type_id||x.vehicleId||x.dbi||''),ssd:String(x.dt_type_id||x.vehicleId||x.dbi||''),attributes:{year:x.year||x.modelYear||'',modification:x.modification||x.trim||'',engine:x.engine||'',engineCode:x.engineCode||'',power:x.power||'',drive:x.drive||'',body:x.body||'',transmission:x.transmission||''},raw:x};
}

export async function freeFindVehicle(car={}){
  const makes=await freeManufacturers();
  const make=chooseByText(makes,car.make||car.brand);
  if(!make) throw new Error('free_vehicle_make_not_found');
  const models=await freeModels(make.dbi);
  const model=chooseByText(models,car.model||car.name);
  if(!model) throw new Error('free_vehicle_model_not_found');
  const mods=await freeModifications(model.dbi);
  const year=Number(car.year||0); const engine=norm(car.engine||''); const transmission=norm(car.transmission||'');
  const candidates=mods.filter(m=>{const a=dateYear(m.cb),b=dateYear(m.ce);return !year || ((!a||year>=a)&&(!b||year<=b))});
  const pool=candidates.length?candidates:mods;
  const best=pool.map(m=>{let s=scoreText(`${m.d} ${m.fd}`,[engine]); if(transmission)s+=scoreText(`${m.d} ${m.fd}`,[transmission]); return {m,s}}).sort((a,b)=>b.s-a.s)[0]?.m;
  if(!best) throw new Error('free_vehicle_modification_not_found');
  return {catalog:'free',brand:make.ds||make.d||car.make,name:model.fd||model.d||car.model,vehicleId:String(best.dbi),ssd:String(best.dbi),attributes:{year:year||dateYear(best.cb)||'',modification:best.fd||best.d,engine:best.capacity||best.engineCode||best.engineType||'',engineCode:best.engineCode||'',power:best.power||'',drive:best.driveType||'',body:best.bodyType||'',modelId:model.dbi,makeId:make.dbi},raw:{make,model,modification:best}};
}
export async function freeTree(v){
  const key=String(v?.vehicleId||'');
  if(!key) return [];
  const hit=freeTreeCache.get(key);
  if(hit && Date.now()-hit.at<5*60*1000) return hit.rows;
  const rows=arr(await fapi('/catalogList/dt/treeList',{mi:key})).map(x=>({i:x.i,d:String(x.d||''),mi:x.mi,pi:x.pi,searchtreeid:x.searchtreeid}));
  freeTreeCache.set(key,{at:Date.now(),rows}); return rows;
}
export async function freeProducts(v,nodei){
  const key=`${String(v?.vehicleId||'')}:${String(nodei||'')}`;
  const hit=freeProductsCache.get(key);
  if(hit && Date.now()-hit.at<5*60*1000) return hit.rows;
  const rows=arr(await fapi('/catalogList/dt/productList',{nodei,modi:v.vehicleId}));
  freeProductsCache.set(key,{at:Date.now(),rows}); return rows;
}
export async function freeSearch(v,query){
  const terms=expandQuery(query); const tree=await freeTree(v);
  if(!tree.length) return [];
  // Сначала берём узлы, в названии которых есть хотя бы один термин. Если
  // название узла общее (например «Тормозная система»), позже проверяем
  // сами карточки деталей — так поиск не зависит только от названия узла.
  const ranked=tree.map(n=>({n,s:scoreText(n.d,terms)})).sort((a,b)=>b.s-a.s);
  const candidates=ranked.filter(x=>x.s>0).slice(0,18);
  const fallback=ranked.filter(x=>x.s===0).slice(0,12);
  const nodeRows=[...candidates,...fallback].slice(0,24);
  const out=[];
  for(const r of nodeRows){
    const products=await freeProducts(v,r.n.i);
    for(const p of products){
      const name=String(p.d||''); const article=String(p.n||''); const brand=String(p.mfd||'');
      const score=scoreText(`${r.n.d} ${name} ${brand} ${article}`,terms);
      if(score>0 || r.s>0) out.push({
        name:name||'Запчасть',oem:'',article,brand,nodeId:String(r.n.i),nodeName:r.n.d,
        fitment:'Подходит для выбранной модификации',source:'FAPI',searchScore:score+r.s
      });
    }
  }
  const seen=new Set();
  return out.sort((a,b)=>b.searchScore-a.searchScore).filter(x=>{const k=`${x.brand}|${x.article}|${x.name}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,50);
}
export async function freeAnalogs(article){
  if(!article)return [];
  const d=await fapi('/analogList',{n:article,r:0});
  const products=arr(d?.productList?.p); const brands=arr(d?.manufacturerList?.mf); const byId=new Map(brands.map(x=>[String(x.i),x.ds]));
  const links=arr(d?.analogList?.a);
  const ids=new Set(links.map(x=>String(x.pai)).filter(Boolean));
  return products.filter(p=>ids.has(String(p.i))).map(p=>({brand:byId.get(String(p.mfi))||'',article:p.n||'',name:p.d||'',confidence:p.sr||0})).slice(0,20);
}
export async function freeCategories(v){return freeTree(v).then(a=>a.filter(x=>x.pi===0).map(x=>({categoryId:String(x.i),name:x.d,code:String(x.i)})))}
export async function freeUnits(v,categoryId='-1'){const tree=await freeTree(v);return tree.filter(x=>categoryId==='-1'||String(x.pi)===String(categoryId)||String(x.i)===String(categoryId)).map(x=>({unitId:String(x.i),name:x.d,code:String(x.i),imageUrl:'',ssd:String(v.vehicleId)}))}
export async function freeUnitDetails(v,unitId){return freeProducts(v,unitId).then(a=>a.map(p=>({name:p.d||'Запчасть',oem:'',codeOnImage:p.n||'',brand:p.mfd||'',note:`${p.mfd||''} ${p.n||''}`.trim()})))}

// Laximo compatibility exports.
export async function findVehicle(identString){const data=await laximo('/findVehicle',{identString,localized:'true',locale:'ru_RU'});return arr(data).map(normalizeVehicle)}
export async function listCatalogs(){return arr(await laximo('/listCatalogs',{locale:'ru_RU'})).map(x=>({name:x.name||'',code:x.code||'',brand:x.brand||'',features:arr(x.features).map(f=>f.name||f)}))}
export async function listCategories(v){return arr(await laximo('/listCategories',{catalog:v.catalog,vehicleId:v.vehicleId,ssd:v.ssd,categoryId:-1,locale:'ru_RU'}))}
export async function listUnits(v,categoryId='-1'){return arr(await laximo('/listUnits',{catalog:v.catalog,vehicleId:v.vehicleId,ssd:v.ssd,categoryId,locale:'ru_RU'})).map(normalizeUnit)}
export async function listDetailByUnit(v,unitId){return arr(await laximo('/listDetailByUnit',{catalog:v.catalog,unitId,ssd:v.ssd,locale:'ru_RU'})).map(normalizeDetail)}
export async function searchVehicleDetails(v,query){return arr(await laximo('/searchVehicleDetails',{catalog:v.catalog,vehicleId:v.vehicleId,ssd:v.ssd,query,locale:'ru_RU'})).map(normalizeDetail)}
export async function wizard(catalog,ssd=''){return arr(await laximo('/getWizard2',{catalog,ssd,locale:'ru_RU'}))}
export async function wizardFind(catalog,ssd){return arr(await laximo('/findVehicleByWizard2',{catalog,ssd,localized:'true',locale:'ru_RU'})).map(normalizeVehicle)}
export async function quickGroups(v){return arr(await laximo('/listQuickGroup',{catalog:v.catalog,vehicleId:v.vehicleId,ssd:v.ssd,locale:'ru_RU'}))}
export async function quickDetails(v,quickGroupId){return arr(await laximo('/listQuickDetail',{catalog:v.catalog,vehicleId:v.vehicleId,quickGroupId,all:1,ssd:v.ssd,locale:'ru_RU',localized:'true'}))}

export function partsMeta(){return {provider:PARTS_PROVIDER,configured:PARTS_PROVIDER==='free'||laximoConfigured(),capabilities:['марка/модель/год/модификация','поиск детали по названию','поиск по названию детали','синонимы названий','применяемость к выбранной модификации','aftermarket-аналоги','структура узлов','схемы узлов'],licenseRequired:false,freeDemo:true,notice:'Бесплатный режим использует публичный FAPI demo API; у него есть общая дневная квота и он предназначен для оценки, не для гарантированной production-нагрузки.'}}
export const partSearchExamples=['задний ступичный подшипник','подшипник ступицы','подшипник переднего колеса','тормозные колодки','масляный фильтр','воздушный фильтр','ремень ГРМ','стойка стабилизатора','шаровая опора','сайлентблок'];
export {expandQuery};
