'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = n => Number(n || 0).toLocaleString();
  const minutes = n => { const v=Math.max(0,Math.round(Number(n)||0)); return v>=60 ? Math.floor(v/60)+'h '+String(v%60).padStart(2,'0')+'m' : v+' min'; };
  const toNumber = (n,d=0) => Number.isFinite(Number(n)) ? Math.round(Number(n)) : d;
  const state = {recipes:[],collections:[],recipeMap:new Map(),collectionMap:new Map(),collectionAliases:{},favorites:new Set(),view:'home',filters:{search:'',country:'',region:'',category:'',sort:'featured',page:0},collectionId:'',readerId:'',sequence:[],ready:false,familyCollectionId:'',familyPdfAvailable:false};
  const pageSize=24;
  try { const ids=JSON.parse(localStorage.getItem('recipe-blueprint-favorites-v1')||'[]'); if(Array.isArray(ids))state.favorites=new Set(ids.map(String)); } catch {}
  let toastHandle=0;
  function toast(message){const e=$('toast');e.textContent=message;e.classList.add('show');clearTimeout(toastHandle);toastHandle=setTimeout(()=>e.classList.remove('show'),3500);}
  function safeText(value,max=5000){return String(value??'').slice(0,max);}
  function totalTime(r){return Math.max(0,...r.steps.map(s=>s.start+s.duration));}
  function readableIntro(intro){
    const value=String(intro??'').trim();
    if(value.length!==350||/[.!?][)"']?$/.test(value))return value;
    // A legacy Studio v6 export cap cut some saved intros mid-word.
    // Prefer a completed sentence over an abrupt fragment.
    const matches=[...value.matchAll(/[.!?](?=\s|$)/g)];
    const last=matches.length?matches[matches.length-1].index+1:-1;
    if(last>95)return value.slice(0,last)+' The full cooking instructions are below.';
    return value.replace(/\s+\S*$/,'').trim()+'…';
  }
  function normalizeRecipe(raw,index){
    if(!raw||typeof raw!=='object')return null;
    const src=raw.recipe&&typeof raw.recipe==='object'?raw.recipe:raw;
    const ingredients=(Array.isArray(src.ingredients)?src.ingredients:[]).map(x=>typeof x==='string'?{amount:'',name:safeText(x,280),prep:''}:({amount:safeText(x?.amount??x?.quantity,150),name:safeText(x?.name??x?.ingredient,280),prep:safeText(x?.prep??x?.preparation,280)})).filter(x=>x.name);
    const steps=(Array.isArray(src.steps)?src.steps:[]).map((x,i)=>({
      id:safeText(x?.id??('step-'+i),100),title:safeText(x?.title??x?.action??x?.name??('Step '+(i+1)),250),
      details:safeText(x?.details??x?.instructions??x?.description,12000),
      start:Math.max(0,Math.min(1440,toNumber(x?.start??x?.start_min??x?.startMin))),
      duration:Math.max(1,Math.min(1440,toNumber(x?.duration??x?.duration_min??x?.durationMin,1))),
      rowStart:Math.max(0,toNumber(x?.rowStart??x?.row_start??x?.from_row??x?.rows?.[0])),
      rowEnd:Math.max(0,toNumber(x?.rowEnd??x?.row_end??x?.to_row??x?.rows?.at?.(-1))),
      kind:['active','passive','heat'].includes(x?.kind??x?.type)?(x.kind??x.type):'active'
    }));
    if(!ingredients.length&&!steps.length)return null;
    steps.forEach(s=>{s.rowStart=Math.min(Math.max(0,ingredients.length-1),s.rowStart);s.rowEnd=Math.min(Math.max(0,ingredients.length-1),s.rowEnd);if(s.rowEnd<s.rowStart)[s.rowStart,s.rowEnd]=[s.rowEnd,s.rowStart];});
    const title=safeText(raw.title??src.title??'Untitled recipe',250);
    return {id:safeText(raw.id??('recipe-'+index),120),title,category:safeText(raw.category??'Unsorted',100),country:safeText(raw.country??'Unspecified',100),region:safeText(raw.region??'',100),collectionId:safeText(raw.collectionId??'',120),updated:Number(raw.updated)||0,sourcePdf:raw.sourcePdf&&typeof raw.sourcePdf==='object'?raw.sourcePdf:null,
      image:raw.image??raw.photo??raw.imageUrl??null,
      recipe:{image:src.image??src.photo??src.imageUrl??null,title:safeText(src.title??title,250),yield:safeText(src.yield??src.servings??'',220),intro:safeText(src.intro??src.prep_note??src.prepNote??'',20000),finish:safeText(src.finish??src.notes??'',2400),ingredients,steps}};
  }
  function normalizeData(data){
    const entries=Array.isArray(data)?data:(Array.isArray(data?.recipes)?data.recipes:null);
    if(!entries)throw Error('The JSON must contain a recipes array. Export a full library backup from Recipe Blueprint Studio.');
    const recs=[];const used=new Set();
    entries.forEach((raw,i)=>{const r=normalizeRecipe(raw,i);if(!r)return;let id=r.id;while(used.has(id))id=r.id+'-'+i;used.add(id);r.id=id;recs.push(r);});
    const collections=[];const known=new Set();
    function addCollection(c){if(!c||typeof c!=='object')return;const id=safeText(c.id??c.collectionId??'',120);if(!id||known.has(id))return;known.add(id);collections.push({id,name:safeText(c.name??c.title??'Untitled collection',240),type:c.type==='event'?'event':'cookbook',targetCount:Math.max(0,toNumber(c.targetCount??c.target)),created:Number(c.created)||0,planned:0,recovered:!!c.recovered});}
    if(Array.isArray(data?.collections))data.collections.forEach(addCollection);
    const plans=[...(Array.isArray(data?.plans)?data.plans:[]),...(data?.plan?[data.plan]:[])];
    plans.forEach(p=>{if(!p||typeof p!=='object')return;const id=safeText(p.collectionId??'',120);if(!id)return;addCollection({id,name:p.name,type:p.type,targetCount:p.targetCount,created:p.created});const col=collections.find(c=>c.id===id);if(col){col.planned=Math.max(col.planned,Array.isArray(p.items)?p.items.length:0);col.targetCount=Math.max(col.targetCount,toNumber(p.targetCount));}});
    recs.forEach(r=>{if(r.collectionId&&!known.has(r.collectionId))addCollection({id:r.collectionId,name:state.collectionAliases[r.collectionId]||('Unnamed cookbook '+r.collectionId.slice(-5)),type:'cookbook',recovered:true});});
    return {recipes:recs,collections};
  }
  function writeUrl(params,replace=false){const url=new URL(window.location.href);url.search='';for(const [k,v] of Object.entries(params)){if(v)url.searchParams.set(k,String(v));}history[replace?'replaceState':'pushState']({},'',url.pathname+url.search+url.hash);}
  function navView(view,options={}){state.view=view;state.collectionId=options.collectionId||'';state.filters.page=0;state.filters.search=options.search??'';state.filters.country='';state.filters.region='';state.filters.category='';state.filters.sort='featured';if(!options.noHistory)writeUrl({view:view==='home'?'':view,collection:state.collectionId});renderPage();closeReader(false);window.scrollTo(0,0);}
  function routeFromUrl(){const u=new URL(window.location.href),view=u.searchParams.get('view')||'home',cid=u.searchParams.get('collection')||'',rid=u.searchParams.get('recipe')||'';
    state.view=['home','recipes','cookbooks','events','favorites','collection'].includes(view)?view:'home';state.collectionId=cid;state.filters.page=0;
    renderPage();if(rid&&state.recipeMap.has(rid))showReader(rid,false);else closeReader(false);}
  function isAirFryerRecipe(r){
  return /\bair[\s-]*(?:fry|fried|fryer|frying)\b/i.test(r.title+' '+r.recipe.intro);
}
  function isUSRecipe(r){
  return /^United States(?:$|[\s(/-])/i.test(r.country);
}
  function curatedAmericanPatterns(){
  return [
    /^Chicken Pot Pie$/i,
    /^Classic Baked Macaroni and Cheese$/i,
    /^Buttermilk Pancakes$/i,
    /^Chewy Chocolate Chip Cookies$/i,
    /^Classic American Apple Pie$/i,
    /^Baked Cheeseburger Sliders$/i,
    /^Buttermilk Fried Chicken$/i,
    /^Classic Chicken Noodle Soup$/i,
    /^Baked Ziti$/i,
    /^Grilled Cheese Sandwiches$/i,
    /^Biscuits and Gravy$/i,
    /^Classic Tomato Soup$/i,
    /^Classic Deviled Eggs$/i,
    /^Roast Turkey with Gravy$/i,
    /^Cinnamon Rolls$/i,
    /^Key Lime Pie$/i,
    /^Skillet Mac and Cheese$/i,
    /^Banana Bread$/i
  ];
}
  function recipeFeatureRank(r){
  // Editorial ranking of familiar recipes, not a claim about actual reader statistics.
  const title=r.title.toLowerCase();
  const patterns=curatedAmericanPatterns();
  const exactIndex=patterns.findIndex(re=>re.test(r.title));
  if(exactIndex>=0)return exactIndex;
  let score=100;
  if(/chicken|beef|pork|turkey|pot roast|pancake|brownie|cookie|pie|pasta|bread|casserole|soup|salad|potato|grilled cheese|burger|chili|cornbread/.test(title))score-=25;
  if(/classic|homemade|easy|weeknight|family|traditional|simple/.test(title))score-=12;
  if(/main dishes|mains|breakfast|desserts/.test(r.category.toLowerCase()))score-=10;
  if(/smoked|spicy|fusion|paleo|keto|gluten.free|sugar.free/.test(title))score+=12;
  score+=Math.min(20,Math.floor(title.length/12));
  return score;
}
  function pickPopularAmericanRecipes(limit=12,exclude=new Set()){
  const eligible=state.recipes.filter(r=>isUSRecipe(r)&&!isAirFryerRecipe(r)&&!exclude.has(r.id));
  eligible.sort((a,b)=>recipeFeatureRank(a)-recipeFeatureRank(b)||a.title.localeCompare(b.title));
  const selected=[],seen=new Set();
  for(const r of eligible){
    const stem=r.title.toLowerCase().replace(/\b(classic|easy|homemade|traditional|southern|american|chewy)\b/g,'').trim();
    if(seen.has(stem))continue;
    selected.push(r);seen.add(stem);
    if(selected.length>=limit)break;
  }
  return selected;
}
  function isFamilyRecipe(r){return !!state.familyCollectionId&&r.collectionId===state.familyCollectionId;}
  const familiarFamilyTitles=['Brownies','Beef Pot Roast','Pot Roast','Chocolate Cake (Trib)','Chocolate Sour Cream Cake','Apple Upside Down Cake','Coffee Cake','Blueberry Pie','Lemon Meringue Pie','Chocolate Ice Cream','French Pancakes','Potato Salad Recipe','Chicken Pilaf (Tribune)','Lemon Crumb Squares','Chocolate Ice Box Cake','Cherry Cheese Pie','Corn Meal Waffles','Sweet Potatoes Southern','Chicken and Shrimp Jambalaya','Apple Skillet Cake','Potatoes Anna','Broccoli Casserole'];
  function familyRank(r){
    const n=familiarFamilyTitles.findIndex(v=>v.toLowerCase()===r.title.toLowerCase());
    if(n>=0)return n;
    const t=r.title.toLowerCase(),cat=r.category.toLowerCase();
    return 200-(/chicken|beef|pot roast|brownie|cookie|cake|pie|pancake|waffle|pudding|potato|casserole|salad|soup|bread/.test(t)?65:0)-(/main dishes|desserts|breakfast|breads/.test(cat)?30:0)+(/dressing|topping|relish|fondue|aspic|mousse|sauce/.test(t)?30:0);
  }
  function featuredFamilyRecipes(limit=12){return state.recipes.filter(isFamilyRecipe).sort((a,b)=>familyRank(a)-familyRank(b)||a.title.localeCompare(b.title)).slice(0,limit);}
  function currentRecipeSet(){
    const f=state.filters;let list=state.view==='favorites'?state.recipes.filter(r=>state.favorites.has(r.id)):state.view==='collection'?state.recipes.filter(r=>r.collectionId===state.collectionId):state.recipes.slice();
    const search=f.search.toLocaleLowerCase().trim();
    if(search)list=list.filter(r=>[r.title,r.category,r.country,r.region,state.collectionMap.get(r.collectionId)?.name||'',...r.recipe.ingredients.map(i=>i.name)].join(' ').toLocaleLowerCase().includes(search));
    if(f.country)list=list.filter(r=>r.country===f.country);
    if(f.region)list=list.filter(r=>r.region===f.region);
    if(f.category)list=list.filter(r=>r.category===f.category);
    if(f.sort==='featured')list.sort((a,b)=>{
      const tier=r=>isFamilyRecipe(r)?0:isUSRecipe(r)&&!isAirFryerRecipe(r)?1:!isAirFryerRecipe(r)?2:3;
      return tier(a)-tier(b)||(isFamilyRecipe(a)&&isFamilyRecipe(b)?familyRank(a)-familyRank(b):recipeFeatureRank(a)-recipeFeatureRank(b))||a.title.localeCompare(b.title);
    });
    else if(f.sort==='newest')list.sort((a,b)=>b.updated-a.updated||a.title.localeCompare(b.title));
    else if(f.sort==='time')list.sort((a,b)=>totalTime(a.recipe)-totalTime(b.recipe)||a.title.localeCompare(b.title));
    else if(f.sort==='country')list.sort((a,b)=>a.country.localeCompare(b.country)||a.title.localeCompare(b.title));
    else list.sort((a,b)=>a.title.localeCompare(b.title));
    return list;
  }
  function collectionItems(type){return state.collections.filter(c=>!type||c.type===type).sort((a,b)=>Number(b.id===state.familyCollectionId)-Number(a.id===state.familyCollectionId)||b.created-a.created||a.name.localeCompare(b.name));}
  function countOfCollection(id){return state.recipes.filter(r=>r.collectionId===id).length;}
  function recipeArt(r){return /dessert|cake|cookie|sweet|brownie|pie|pudding/i.test(r.category)?'dessert':'';}
  function recipeCard(r){
    const col=state.collectionMap.get(r.collectionId);
    return `<article class="recipe-card">
      <a href="?view=${encodeURIComponent(state.view)}&recipe=${encodeURIComponent(r.id)}" data-open-recipe="${esc(r.id)}" aria-label="Read ${esc(r.title)}">
        <div class="card-art ${recipeArt(r)}" data-recipe-photo="${esc(r.id)}"><span class="art-symbol">${recipeArt(r)?'◈':'▦'}</span></div>
        <div class="card-body"><span class="card-eyebrow">${isFamilyRecipe(r)?'STONE FAMILY · ':''}${esc(r.category)}${r.country&&r.country!=='Unspecified'?' · '+esc(r.country):''}</span>
          <h3>${esc(r.title)}</h3><p>${esc(col?.name||r.region||'From the collection')}</p>
          <div class="card-bottom"><span>◷ ${r.sourcePdf?.timeIsPlaceholder?'Time not recorded':esc(minutes(totalTime(r.recipe)))}</span><span>▤ ${r.recipe.ingredients.length} ingredients</span><span>✓ ${r.recipe.steps.length} steps</span></div>
        </div>
      </a>
      <div class="card-actions"><button type="button" class="card-open" data-open-recipe="${esc(r.id)}">View full recipe →</button><a class="photo-credit-link" data-photo-credit="${esc(r.id)}" href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer" hidden>Photo credit</a><button type="button" class="favorite-toggle ${state.favorites.has(r.id)?'saved':''}" data-favorite="${esc(r.id)}" aria-label="${state.favorites.has(r.id)?'Remove from saved':'Save recipe'}" aria-pressed="${state.favorites.has(r.id)}">${state.favorites.has(r.id)?'♥':'♡'}</button></div>
    </article>`;
  }
  function collectionCard(c){
    const done=countOfCollection(c.id),target=Math.max(done,c.targetCount,c.planned);
    const kind=c.type==='event'?'Event menu':'Cookbook';
    return `<article class="collection-card"><button type="button" data-open-collection="${esc(c.id)}" aria-label="Browse ${esc(c.name)}">
      <div class="card-art ${c.type==='event'?'event':'book'}"><span class="art-symbol">${c.type==='event'?'✳':'▤'}</span></div>
      <div class="card-body"><span class="card-eyebrow">${c.id===state.familyCollectionId?'★ FEATURED · ':''}${kind}${c.recovered?' · Descriptive title':''}</span><h3>${esc(c.name)}</h3>
      <p>${done?number(done)+' published recipe'+(done===1?'':'s'):'No published recipes yet'}${target>done?' · '+number(target)+' planned total':''}</p>
      ${target?'<div class="collection-progress"><span style="width:'+Math.min(100,Math.round(done/target*100))+'%"></span></div>':''}
      <div class="card-bottom"><strong>Explore collection →</strong><span>${number(done)} available</span></div></div></button></article>`;
  }
  function heading(title,kicker,description){
    return `<div class="browse-title"><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div>`;
  }
  function renderHome(){
    const books=collectionItems('cookbook'),events=collectionItems('event'),featured=[...books,...events].slice(0,4);
    const familyFavorites=featuredFamilyRecipes(12);
    const popular=pickPopularAmericanRecipes(12);
    const excluded=new Set(popular.map(r=>r.id));
    const more=pickPopularAmericanRecipes(8,excluded);
    state.sequence=[...familyFavorites,...popular,...more].map(r=>r.id);
    const familyBlock=familyFavorites.length?'<section class="section-block family-home-block"><div class="section-heading"><div><span class="eyebrow">★ FEATURED FAMILY COOKBOOK</span><h2>Stone Family Recipes</h2><p>236 restored family recipes. Browse familiar favorites and check the original manuscript pages.</p></div><button class="text-link" data-open-collection="'+esc(state.familyCollectionId)+'">Browse family cookbook →</button></div><div class="card-grid">'+familyFavorites.map(recipeCard).join('')+'</div></section>':'';
    $('content').innerHTML=`
    ${familyBlock}
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">POPULAR AMERICAN CLASSICS</span><h2>What sounds good today?</h2><p>Handpicked familiar favorites from the U.S. collection — no air-fryer recipes in this featured selection.</p></div><button class="text-link" data-view="recipes">See all recipes →</button></div>
    ${popular.length?'<div class="card-grid">'+popular.map(recipeCard).join('')+'</div>':'<div class="empty-state"><h2>Recipes are coming soon</h2><p>Check back for more featured recipes.</p></div>'}</section>
    <section class="stat-strip"><div class="stat-block"><strong>${number(state.recipes.length)}</strong><span>Complete recipes</span></div><div class="stat-block"><strong>${number(books.length)}</strong><span>Cookbooks</span></div><div class="stat-block"><strong>${number(events.length)}</strong><span>Event menus</span></div><div class="stat-block"><strong>${number(new Set(state.recipes.map(r=>r.country).filter(x=>x&&x!=='Unspecified')).size)}</strong><span>Countries represented</span></div></section>
    ${featured.length?`<section class="section-block"><div class="section-heading"><div><span class="eyebrow">EXPLORE YOUR COLLECTIONS</span><h2>Browse the bookshelf</h2><p>Browse cookbooks, family meals, and event menus.</p></div><button class="text-link" data-view="cookbooks">View all cookbooks →</button></div><div class="card-grid">${featured.map(collectionCard).join('')}</div></section>`:''}
    ${more.length?`<section class="section-block"><div class="section-heading"><div><span class="eyebrow">MORE EVERYDAY FAVORITES</span><h2>Keep cooking</h2><p>More familiar meals and comfort-food recipes to try.</p></div><button class="text-link" data-view="recipes">Explore full recipe library →</button></div><div class="card-grid">${more.map(recipeCard).join('')}</div></section>`:''}`;
    window.RecipeBlueprintPhotos?.observe($('content'),state.recipeMap);
  }
  function optionList(values,placeholder,chosen){return '<option value="">'+esc(placeholder)+'</option>'+values.sort((a,b)=>a.localeCompare(b)).map(v=>'<option value="'+esc(v)+'"'+(v===chosen?' selected':'')+'>'+esc(v)+'</option>').join('');}
  function renderBrowser(){
    const col=state.collectionMap.get(state.collectionId);
    const isCollection=state.view==='collection';
    const kind=state.view==='favorites'?'YOUR PERSONAL LIST':isCollection?(col?.type==='event'?'EVENT MENU':'COOKBOOK'):'THE COMPLETE LIBRARY';
    const title=isCollection?(col?.name||'Collection not found'):state.view==='favorites'?'Saved recipes':'All recipes';
    const description=isCollection?'Explore the recipes published in this collection.':state.view==='favorites'?'Your saved choices live only in this browser.':'Browse popular U.S. favorites first, or search every recipe, ingredient, country, and category.';
    const base=isCollection?state.recipes.filter(r=>r.collectionId===state.collectionId):state.view==='favorites'?state.recipes.filter(r=>state.favorites.has(r.id)):state.recipes;
    const unique=key=>[...new Set(base.map(r=>r[key]).filter(x=>x&&x!=='Unspecified'))];
    $('content').innerHTML=(isCollection?'<div class="breadcrumbs"><button data-view="'+(col?.type==='event'?'events':'cookbooks')+'">← All '+(col?.type==='event'?'events':'cookbooks')+'</button><span>/</span><span>'+esc(col?.name||'Collection')+'</span></div>':'')
    +heading(title,kind,description)+`<div class="browse-controls">
      <div class="field"><label for="filterSearch">Search recipes & ingredients</label><input id="filterSearch" type="search" placeholder="Try pizza, chicken, holiday…" value="${esc(state.filters.search)}"></div>
      <div class="field"><label for="filterCategory">Dish type</label><select id="filterCategory">${optionList(unique('category'),'All categories',state.filters.category)}</select></div>
      <div class="field"><label for="filterCountry">Country</label><select id="filterCountry">${optionList(unique('country'),'All countries',state.filters.country)}</select></div>
      <div class="field"><label for="filterRegion">Region</label><select id="filterRegion">${optionList(unique('region'),'All regions',state.filters.region)}</select></div>
      <div class="field"><label for="filterSort">Sort by</label><select id="filterSort"><option value="featured">Featured · U.S. classics first</option><option value="title">Name A–Z</option><option value="newest">Recently added</option><option value="country">Country A–Z</option><option value="time">Fastest first</option></select></div>
    </div><div class="browse-meta"><span id="resultsCount"></span><button type="button" id="clearFilters">Clear filters</button></div><div class="card-grid" id="browseGrid"></div><div class="pagination" id="browsePager"></div>`;
    $('filterSort').value=state.filters.sort;renderBrowseGrid();
  }
  function renderBrowseGrid(){
    const list=currentRecipeSet(),pages=Math.max(1,Math.ceil(list.length/pageSize));state.filters.page=Math.min(state.filters.page,pages-1);
    state.sequence=list.map(r=>r.id);
    const shown=list.slice(state.filters.page*pageSize,(state.filters.page+1)*pageSize);
    $('resultsCount').textContent=number(list.length)+' matching recipe'+(list.length===1?'':'s')+' · '+number(state.recipes.length)+' total in library';
    $('browseGrid').innerHTML=shown.length?shown.map(recipeCard).join(''):`<div class="empty-state" style="grid-column:1/-1"><h2>No recipes found</h2><p>${state.view==='collection'?'This collection has no published recipes matching your filters.':'Try another search, country, or dish type.'}</p></div>`;
    $('browsePager').innerHTML=list.length>pageSize?`<button class="button button-secondary compact" data-page="-1" ${state.filters.page===0?'disabled':''}>← Previous</button><span>Page ${state.filters.page+1} of ${pages}</span><button class="button button-secondary compact" data-page="1" ${state.filters.page+1===pages?'disabled':''}>Next →</button>`:'';
    window.RecipeBlueprintPhotos?.observe($('content'),state.recipeMap);
  }
  function renderCollections(){
    const event=state.view==='events',cols=collectionItems(event?'event':'cookbook');
    $('content').innerHTML=heading(event?'Event menus':'The cookbook shelf',event?'CELEBRATIONS & GATHERINGS':'COOKBOOK COLLECTIONS',event?'Holiday feasts, parties, and complete meals in one place.':'Explore the named cookbooks and collections. Where the export lost a book title, a descriptive title based on its recipes is shown.')
    +`<div class="browse-meta"><span>${number(cols.length)} ${event?'event menu':'cookbook'}${cols.length===1?'':'s'} · ${number(cols.reduce((n,c)=>n+countOfCollection(c.id),0))} published recipes</span></div>`
    +(cols.length?'<div class="card-grid">'+cols.map(collectionCard).join('')+'</div>':'<div class="empty-state"><h2>Nothing on this shelf yet</h2><p>Collections from the published JSON will show here automatically.</p></div>');
  }
  function updateNav(){document.querySelectorAll('.nav-link').forEach(el=>{const active=el.dataset.view===state.view||(state.view==='collection'&&el.dataset.view===(state.collectionMap.get(state.collectionId)?.type==='event'?'events':'cookbooks'));el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('favoriteCount').textContent=number(state.favorites.size);}
  function renderPage(){
    updateNav();if(!state.ready)return;
    $('homeHero').hidden=state.view!=='home';
    $('statusArea').hidden=true;
    if(state.view==='home')renderHome();
    else if(state.view==='cookbooks'||state.view==='events')renderCollections();
    else renderBrowser();
  }
  function toggleFavorite(id){
    if(state.favorites.has(id))state.favorites.delete(id);else state.favorites.add(id);
    try{localStorage.setItem('recipe-blueprint-favorites-v1',JSON.stringify([...state.favorites]));}catch{toast('This browser cannot save favorites.');}
    updateNav();if(state.readerId===id){const el=$('readerFavorite'),saved=state.favorites.has(id);el.textContent=saved?'♥ Saved':'♡ Save';el.setAttribute('aria-pressed',String(saved));}
    if(state.view==='home')renderHome();else if(['recipes','favorites','collection'].includes(state.view))renderBrowseGrid();
  }
  function showReader(id,push=true){
    const item=state.recipeMap.get(id);if(!item)return;
    if(push)writeUrl({view:state.view==='home'?'recipes':state.view,collection:state.collectionId,recipe:id});
    state.readerId=id;$('recipeOverlay').hidden=false;document.body.style.overflow='hidden';$('readerScroll').scrollTop=0;
    if(!state.sequence.length)state.sequence=state.recipes.map(r=>r.id);
    const r=item.recipe;const col=state.collectionMap.get(item.collectionId);
    $('readerTitle').textContent=r.title||item.title;
    $('readerIntro').textContent=readableIntro(r.intro);
    $('readerTags').innerHTML=[item.category,item.country!=='Unspecified'?item.country:'',item.region,col?.name].filter(Boolean).map(v=>'<span class="tag">'+esc(v)+'</span>').join('');
    $('readerTotal').textContent=minutes(totalTime(r));$('readerYield').textContent=r.yield||'';
    $('readerIngredientCount').textContent=r.ingredients.length+' ingredients';
    $('readerIngredients').innerHTML=r.ingredients.map((ing,i)=>`<label class="ingredient-item"><input type="checkbox" aria-label="Mark ${esc(ing.name)} as ready"><div><b>${esc(ing.amount)}</b> ${esc(ing.name)}<small>${esc(ing.prep||'')}</small></div></label>`).join('');
    const steps=[...r.steps].sort((a,b)=>a.start-b.start||a.rowStart-b.rowStart);
    $('readerStepCount').textContent=steps.length+' steps';
    $('readerSteps').innerHTML=steps.map((s,i)=>`<div class="direction-item"><span class="direction-no">${i+1}</span><div class="direction-main"><h3>${esc(s.title)}</h3><p>${esc(s.details||s.title)}</p></div><span class="direction-time">${esc(minutes(s.start))} · ${esc(minutes(s.duration))}</span></div>`).join('');
    $('readerFinish').hidden=!r.finish;$('readerFinish').innerHTML=r.finish?'<strong>Finish & serve:</strong> '+esc(r.finish):'';
    $('readerTimeline').innerHTML=renderTimeline(r);
    $('recipeOverlay').dataset.openRecipe=id;
    window.RecipeBlueprintPhotos?.showReader(item,id);
    const saved=state.favorites.has(id);$('readerFavorite').textContent=saved?'♥ Saved':'♡ Save';$('readerFavorite').setAttribute('aria-pressed',String(saved));
    const idx=state.sequence.indexOf(id);$('readerPrev').disabled=idx<=0;$('readerNext').disabled=idx<0||idx===state.sequence.length-1;
    $('readerPosition').textContent=idx>=0?(number(idx+1)+' of '+number(state.sequence.length)+' recipes'):'Recipe details';
    document.title=(r.title||item.title)+' | Recipe Blueprint';
  }
  function closeReader(clearUrl=true){
    state.readerId='';$('recipeOverlay').dataset.openRecipe='';$('recipeOverlay').hidden=true;document.body.style.overflow='';document.title='Recipe Blueprint | Cookbooks & Recipes';
    if(clearUrl&&new URL(window.location.href).searchParams.has('recipe'))writeUrl({view:state.view==='home'?'recipes':state.view,collection:state.collectionId});
  }
  function renderTimeline(r){
    if(!r.ingredients.length||!r.steps.length)return '<div class="empty-state"><p>Full timed steps are not available for this recipe.</p></div>';
    const total=Math.max(1,totalTime(r)),tick=total>240?30:total>90?15:total>40?10:5;
    const bounds=new Set([0,total]);
    for(let t=tick;t<total;t+=tick)bounds.add(t);
    for(const s of r.steps){bounds.add(Math.min(total,s.start));bounds.add(Math.min(total,s.start+s.duration));}
    const b=[...bounds].filter(x=>x>=0&&x<=total).sort((a,z)=>a-z);
    const seg=b.slice(0,-1).map((start,i)=>({start,length:b[i+1]-start}));
    const idx=new Map(b.map((v,i)=>[v,i]));const cols=seg.length,rows=r.ingredients.length;
    const used=Array.from({length:rows},()=>Array(cols).fill(null));
    const steps=[...r.steps].sort((a,z)=>a.start-z.start||a.rowStart-z.rowStart);
    const names=new Map(steps.map((s,i)=>[s,i+1]));
    for(const s of steps){
      const start=idx.get(s.start),end=idx.get(s.start+s.duration);
      if(start===undefined||end===undefined||start>=end)continue;
      let occupied=false;
      for(let row=s.rowStart;row<=s.rowEnd&&!occupied;row++)for(let c=start;c<end;c++)if(used[row]?.[c]){occupied=true;break;}
      if(occupied)continue;
      for(let row=s.rowStart;row<=s.rowEnd;row++)for(let c=start;c<end;c++)used[row][c]={step:s,anchor:row===s.rowStart&&c===start};
    }
    const usableWidth=Math.max(660,Math.min(4000,total*6));const scale=usableWidth/total;
    const side=215,prep=95;let html='<table class="timeline-table" style="width:'+(usableWidth+side+prep)+'px" aria-label="Timed cooking blueprint"><colgroup><col style="width:'+side+'px"><col style="width:'+prep+'px">';
    for(const s of seg)html+='<col style="width:'+Math.max(1,s.length*scale)+'px">';
    html+='</colgroup><thead><tr><th colspan="'+(2+cols)+'" class="timeline-title">'+esc(r.title)+' · '+esc(minutes(total))+'</th></tr><tr><th class="timeline-colhead">Ingredient & amount</th><th class="timeline-colhead">Preparation</th>';
    for(let c=0;c<cols;){const t=seg[c].start;let end=c+1;while(end<cols&&seg[end].start%tick!==0)end++;html+='<th colspan="'+(end-c)+'" class="timehead">'+esc(minutes(t))+'</th>';c=end;}
    html+='</tr></thead><tbody>';
    r.ingredients.forEach((ing,row)=>{
      html+='<tr style="height:47px"><td class="timeline-ingredient"><b>'+esc(ing.amount)+'</b> '+esc(ing.name)+'</td><td class="timeline-prep">'+esc(ing.prep)+'</td>';
      for(let c=0;c<cols;){const cell=used[row][c];if(cell&&!cell.anchor){c++;continue;}
        if(cell?.anchor){const s=cell.step,from=idx.get(s.start),to=idx.get(s.start+s.duration);const width=(to-from)*scale*total/Math.max(1,cols);const actual=s.duration*scale;
          const narrow=actual<100, tiny=actual<32;
          html+='<td class="timeline-event '+esc(s.kind)+(narrow?' narrow':'')+(tiny?' tiny':'')+'" rowspan="'+(s.rowEnd-s.rowStart+1)+'" colspan="'+(to-from)+'" title="'+esc(s.title+' — '+s.details)+'"><strong>'+(tiny?names.get(s):esc(s.title))+'</strong>'+(narrow?'':'<small>'+esc(minutes(s.duration))+'</small>')+'</td>';c=to;continue;}
        let end=c+1;while(end<cols&&!used[row][end])end++;html+='<td class="timeline-blank" colspan="'+(end-c)+'"></td>';c=end;
      }
      html+='</tr>';
    });
    return html+'</tbody></table>';
  }
  function goAdjacent(delta){const i=state.sequence.indexOf(state.readerId);const id=state.sequence[i+delta];if(id)showReader(id);}
  async function shareRecipe(){const link=window.location.href;try{await navigator.clipboard.writeText(link);toast('Recipe link copied.');}catch{window.prompt('Copy recipe link:',link);}}
  async function load(){
    try{
      const response=await fetch('./recipes.json',{cache:'no-store'});
      if(!response.ok)throw Error(response.status===404?'recipes.json is not uploaded yet.':'Could not load recipes.json (HTTP '+response.status+').');
      let data=await response.json();
      // Compressed publication bundles are assembled and decompressed in the visitor's browser.
      // Regular full-library recipes.json exports remain supported without modification.
      if(data?.format==='recipe-blueprint-compressed-v1'){
        if(typeof DecompressionStream==='undefined')throw Error('This browser cannot unpack the recipe library. Please use a current version of Chrome, Edge, Firefox or Safari.');
        const pieces=await Promise.all(data.parts.map(async part=>{
          if(!/^data\/recipes-\d+\.b64$/.test(part))throw Error('Invalid recipe archive part in manifest.');
          const res=await fetch('./'+part);
          if(!res.ok)throw Error('Missing recipe library part: '+part+' (HTTP '+res.status+').');
          return res.text();
        }));
        const encoded=pieces.join('');
        const binary=atob(encoded);
        const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
        const uncompressed=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        data=JSON.parse(await new Response(uncompressed).text());
      }
      // Optional editorial labels for the 35 collections whose names were missing from the export.
      try{
        const labelsResponse=await fetch('./collection-names.json',{cache:'no-store'});
        if(labelsResponse.ok){
          const labels=await labelsResponse.json();
          state.collectionAliases=labels?.titles||{};
        }
      }catch(e){console.warn('Could not load collection title overrides:',e);}
      const normalized=normalizeData(data);
      try{
        const response=await fetch('./data/stone-family-recipes.json',{cache:'no-store'});
        if(response.ok){
          const manifest=await response.json();
          if(manifest.format==='recipe-blueprint-family-collection-v1'&&Array.isArray(manifest.parts)){
            const parts=await Promise.all(manifest.parts.map(async p=>{
              if(!/^data\/stone-family-recipes-[12]\.json$/.test(p))throw Error('Invalid family archive part');
              const res=await fetch('./'+p,{cache:'no-store'});
              if(!res.ok)throw Error('Missing family recipe archive: '+p);
              return res.json();
            }));
            const family=normalizeData({recipes:parts.flatMap(p=>p.recipes||[]),collections:parts.flatMap(p=>p.collections||[])});
            const existingIds=new Set(normalized.recipes.map(r=>r.id));
            for(const recipe of family.recipes){if(existingIds.has(recipe.id))recipe.id='stone-'+recipe.id;existingIds.add(recipe.id);normalized.recipes.push(recipe);}
            for(const c of family.collections)if(!normalized.collections.some(x=>x.id===c.id))normalized.collections.push(c);
            state.familyCollectionId=manifest.collectionId||family.collections[0]?.id||'';
            try{const pdf=await fetch('./books/stone-family-recipes.pdf',{method:'HEAD',cache:'no-store'});state.familyPdfAvailable=pdf.ok;}catch{state.familyPdfAvailable=false;}
          }
        }
      }catch(error){console.warn('Stone family cookbook did not load:',error);}
      state.recipes=normalized.recipes;state.collections=normalized.collections;
      state.recipeMap=new Map(state.recipes.map(r=>[r.id,r]));
      state.collectionMap=new Map(state.collections.map(c=>[c.id,c]));
      state.ready=true;
      state.sequence=state.recipes.map(r=>r.id);
      routeFromUrl();
    }catch(e){
      $('statusArea').innerHTML='<div class="error-state"><span class="eyebrow">THE LIBRARY IS NOT AVAILABLE YET</span><h2>Recipe data could not be loaded</h2><p>'+esc(e.message)+'</p><p>Site owner: upload the complete Recipe Blueprint Studio library export as <code>recipes.json</code> in the same folder as <code>index.html</code>. The site reads it automatically; no API key or generator is required.</p><button id="retryLoad" class="button button-primary">Retry loading recipes</button></div>';
      $('retryLoad').addEventListener('click',()=>{ $('statusArea').innerHTML='<div class="loading-state"><span class="loading-spinner"></span> Loading cookbook library…</div>';load();});
    }
  }
  document.addEventListener('click',e=>{
    const view=e.target.closest('[data-view]');if(view){e.preventDefault();navView(view.dataset.view);return;}
    const open=e.target.closest('[data-open-recipe]');if(open){e.preventDefault();showReader(open.dataset.openRecipe);return;}
    const col=e.target.closest('[data-open-collection]');if(col){navView('collection',{collectionId:col.dataset.openCollection});return;}
    const fav=e.target.closest('[data-favorite]');if(fav){e.preventDefault();toggleFavorite(fav.dataset.favorite);return;}
    const pg=e.target.closest('[data-page]');if(pg){state.filters.page=Math.max(0,state.filters.page+Number(pg.dataset.page));renderBrowseGrid();document.querySelector('.browse-title')?.scrollIntoView({block:'start'});return;}
    if(e.target.closest('#clearFilters')){state.filters.search='';state.filters.country='';state.filters.region='';state.filters.category='';state.filters.sort='title';state.filters.page=0;renderBrowser();}
  });
  document.addEventListener('input',e=>{if(e.target.id==='filterSearch'){state.filters.search=e.target.value;state.filters.page=0;renderBrowseGrid();}});
  document.addEventListener('change',e=>{
    const mapping={filterCategory:'category',filterCountry:'country',filterRegion:'region',filterSort:'sort'};
    if(mapping[e.target.id]){state.filters[mapping[e.target.id]]=e.target.value;state.filters.page=0;renderBrowseGrid();}
  });
  $('brandLink').addEventListener('click',e=>{e.preventDefault();navView('home');});
  $('searchShortcut').addEventListener('click',()=>{navView('recipes');$('filterSearch')?.focus();});
  $('readerBack').addEventListener('click',()=>closeReader());
  $('readerFavorite').addEventListener('click',()=>{if(state.readerId)toggleFavorite(state.readerId);});
  $('readerShare').addEventListener('click',shareRecipe);
  $('readerPrint').addEventListener('click',()=>window.print());
  $('readerPDF').addEventListener('click',()=>{const r=state.recipeMap.get(state.readerId);if(!r)return;try{window.RecipeBlueprintPDF.export(r.recipe);toast('One-page PDF downloaded.');}catch(e){toast('PDF export failed: '+e.message);console.error(e);}});
  $('readerPrev').addEventListener('click',()=>goAdjacent(-1));
  $('readerNext').addEventListener('click',()=>goAdjacent(1));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.readerId){closeReader();}});
  window.addEventListener('popstate',()=>{if(state.ready)routeFromUrl();});
  load();
})();