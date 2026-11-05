'use strict';
/* Key-free, licensed dish imagery. Wikimedia Commons is queried only for
   visible recipe cards or an opened recipe. No API keys, scraping, or trackers. */
(() => {
  const STORAGE_KEY='recipe-blueprint-photo-cache-v1';
  const CACHE_MAX=350, CACHE_LIFETIME=1000*60*60*24*75, MISS_LIFETIME=1000*60*60*24*3;
  const cache=new Map(), inFlight=new Map(), queue=[];
  let observer=null, active=0, readyOverrides={}, started=false, startPromise=null;
  const ignored=new Set(['classic','easy','homemade','american','traditional','southern','authentic','famous','best','simple','quick','family','fresh','healthy','baked','old','fashioned','favorite','favorites','original','with','without','from','and','the','for','recipe','style','version','dish','food','served','over','our','extra','plus']);
  const unsuitable=/\b(flag|logo|diagram|icon|map|poster|menu|advertisement|advertising|packaging|packaged|infographic|cartoon|illustration|drawing|sketch|painting|clipart|book cover|label|symbol|ingredient list|recipe card|restaurant interior)\b/i;
  function clean(s){return String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function terms(s){return clean(s).split(' ').filter(w=>w.length>2&&!ignored.has(w));}
  function simplifiedTitle(s){
    return String(s??'').replace(/\([^)]*\)/g,' ').replace(/^\s*(?:classic|easy|homemade|authentic|traditional|best|quick|simple|southern|american)\s+/ig,'').replace(/\b(?:recipe|copycat)\b/ig,'').trim() || String(s??'');
  }
  function validHttp(u){try{const x=new URL(u);return x.protocol==='https:'?x.href:'';}catch{return '';}}
  function textOnly(html){
    const doc=new DOMParser().parseFromString(String(html??''),'text/html');
    return (doc.body?.textContent||'').replace(/\s+/g,' ').trim().slice(0,130);
  }
  function cacheKey(recipe){return String(recipe.id||recipe.title||'').slice(0,160);}
  function store(){
    try{
      const recent=[...cache.entries()].slice(-CACHE_MAX);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(recent));
    }catch{/* Browsing may use private mode or blocked storage. */}
  }
  function restore(){
    try{
      const rows=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      if(Array.isArray(rows))for(const [k,v] of rows.slice(-CACHE_MAX)){
        if(k&&v&&Date.now()-(Number(v.checked)||0)<(v.missing?MISS_LIFETIME:CACHE_LIFETIME))cache.set(k,v);
      }
    }catch{}
  }
  function manualPhoto(r){
    const x=readyOverrides[r.id]||readyOverrides[r.title]||r.image||r.photo||r.imageUrl||r.recipe?.image||r.recipe?.photo;
    const obj=typeof x==='string'?{url:x}:x;
    if(!obj||typeof obj!=='object')return null;
    const url=validHttp(obj.url||obj.src||obj.imageUrl||obj.image);
    if(!url)return null;
    return {url,credit:String(obj.credit||obj.photographer||'Recipe image').slice(0,160),
      license:String(obj.license||'Provided by site owner').slice(0,100),source:validHttp(obj.source||obj.sourceUrl||url),manual:true};
  }
  function init(){
    if(started)return startPromise;
    started=true;restore();
    startPromise=fetch('./photos.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(data=>{
      readyOverrides=data?.recipes&&typeof data.recipes==='object'?data.recipes:{};
    }).catch(()=>{readyOverrides={};});
    return startPromise;
  }
  function choosePhoto(pages,recipeTitle){
    const sought=terms(simplifiedTitle(recipeTitle));
    if(!sought.length)return null;
    const choices=[];
    for(const page of pages||[]){
      const info=page.imageinfo?.[0];if(!info)continue;
      if(!/^image\/(?:jpeg|png|webp)$/.test(String(info.mime||'')))continue;
      const thumb=validHttp(info.thumburl||'');
      const source=validHttp(info.descriptionurl||'');
      if(!thumb||!source)continue;
      const file=String(page.title||'').replace(/^File:/i,'').replace(/\.[A-Za-z0-9]{2,5}$/,'').replace(/_/g,' ');
      if(unsuitable.test(file))continue;
      const filename=clean(file), fileTerms=new Set(terms(file));
      const hits=sought.filter(t=>fileTerms.has(t)||filename.includes(t+'s')||filename.includes(t+'es')).length;
      const threshold=sought.length===1?1:sought.length===2?2:Math.max(2,Math.ceil(sought.length*.6));
      if(hits<threshold)continue;
      const ext=info.extmetadata||{};
      const license=textOnly(ext.LicenseShortName?.value||ext.UsageTerms?.value||'');
      if(!license)continue;
      const owner=textOnly(ext.Artist?.value||'Wikimedia Commons contributor');
      const score=hits/sought.length + (filename.includes(clean(simplifiedTitle(recipeTitle)))?.85:0)
        + Math.min(.1,(Number(info.width||0)/16000)) - (filename.length>110?.12:0);
      choices.push({score,url:thumb,source,credit:owner||'Wikimedia Commons contributor',license,manual:false});
    }
    choices.sort((a,b)=>b.score-a.score);
    if(!choices.length)return null;
    const {score,...photo}=choices[0];
    return photo;
  }
  async function queryCommons(title){
    const q=simplifiedTitle(title).slice(0,110);
    const url=new URL('https://commons.wikimedia.org/w/api.php');
    const params={action:'query',generator:'search',gsrsearch:q,gsrnamespace:'6',gsrlimit:'10',
      prop:'imageinfo',iiprop:'url|size|mime|extmetadata',iiurlwidth:'900',format:'json',formatversion:'2',origin:'*'};
    for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),13000);
    try{
      const res=await fetch(url.toString(),{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
      if(!res.ok)throw Error('Wikimedia image search HTTP '+res.status);
      const result=await res.json();
      return choosePhoto(result.query?.pages,title);
    }finally{clearTimeout(timer);}
  }
  function pump(){
    if(active>=2||!queue.length)return;
    const item=queue.shift();active++;
    (async()=>{
      try{
        const photo=await queryCommons(item.title);
        const value=photo?{...photo,checked:Date.now()}:{missing:true,checked:Date.now()};
        cache.delete(item.key);cache.set(item.key,value);store();item.resolve(photo||null);
      }catch(err){
        // Don't cache transient network or rate-limit errors as permanent misses.
        item.resolve(null);
      }finally{
        inFlight.delete(item.key);active--;
        setTimeout(pump,350);
        if(active<2&&queue.length)setTimeout(pump,350);
      }
    })();
    if(active<2&&queue.length)pump();
  }
  async function photoFor(recipe){
    await init();
    const manual=manualPhoto(recipe);if(manual)return manual;
    const key=cacheKey(recipe),existing=cache.get(key);
    if(existing&&Date.now()-existing.checked<(existing.missing?MISS_LIFETIME:CACHE_LIFETIME)){
      cache.delete(key);cache.set(key,existing);
      return existing.missing?null:existing;
    }
    if(inFlight.has(key))return inFlight.get(key);
    const promise=new Promise(resolve=>{queue.push({key,title:recipe.title,resolve});pump();});
    inFlight.set(key,promise);return promise;
  }
  function applyCard(element,recipe){
    if(element.dataset.photoStarted==='true')return;
    element.dataset.photoStarted='true';
    photoFor(recipe).then(photo=>{
      if(!photo||!element.isConnected)return;
      const img=document.createElement('img');
      img.className='recipe-card-image';img.alt='Photograph related to '+recipe.title;
      img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
      img.onload=()=>{
        if(!element.isConnected)return;
        element.classList.add('has-photo');
        const credit=element.closest('.recipe-card')?.querySelector('[data-photo-credit]');
        if(credit){credit.href=photo.source||photo.url;credit.textContent='Photo: '+photo.credit+' · '+photo.license;credit.hidden=false;credit.title=credit.textContent;}
      };
      img.onerror=()=>{img.remove();};
      img.src=photo.url;element.prepend(img);
    });
  }
  function observe(root,recipeMap){
    init();
    if(observer)observer.disconnect();
    if(!root)return;
    const els=Array.from(root.querySelectorAll('[data-recipe-photo]'));
    if('IntersectionObserver' in window){
      observer=new IntersectionObserver(entries=>{
        for(const entry of entries)if(entry.isIntersecting){
          const el=entry.target;observer.unobserve(el);
          const recipe=recipeMap.get(el.dataset.recipePhoto);
          if(recipe)applyCard(el,recipe);
        }
      },{rootMargin:'220px 0px'});
      els.forEach(el=>observer.observe(el));
    }else{
      els.slice(0,28).forEach(el=>{const recipe=recipeMap.get(el.dataset.recipePhoto);if(recipe)applyCard(el,recipe);});
    }
  }
  async function showReader(recipe,readerId){
    const figure=document.getElementById('readerPhotoFigure'),img=document.getElementById('readerPhoto'),
      link=document.getElementById('readerPhotoCredit');
    if(!figure||!img||!link)return;
    figure.hidden=true;img.removeAttribute('src');
    const photo=await photoFor(recipe);
    if(!photo||document.getElementById('recipeOverlay')?.hidden)return;
    if(document.getElementById('recipeOverlay')?.dataset.openRecipe!==String(readerId))return;
    img.onload=()=>{if(document.getElementById('recipeOverlay')?.dataset.openRecipe===String(readerId))figure.hidden=false;};
    img.onerror=()=>{figure.hidden=true;};
    img.alt='Photograph related to '+recipe.title;
    img.src=photo.url;
    link.href=photo.source||photo.url;link.textContent='Photo: '+photo.credit+' · '+photo.license;
  }
  window.RecipeBlueprintPhotos={init,observe,showReader};
})();