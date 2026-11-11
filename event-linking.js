/* Recipe Blueprint event dish to published recipe matching.
   A related recipe is never presented as the exact event dish. */
(() => {
  'use strict';
  const ignored = new Set('a an the and with of for to on from in by at plus style classic homemade easy simple best traditional fresh warm quick ultimate perfect delicious family favorite famous original'.split(' '));
  const normalize = text => String(text || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ')
    .trim().replace(/\s+/g,' ');
  function stem(word){
    const special={potatoes:'potato',tomatoes:'tomato',fries:'fry',berries:'berry',cherries:'cherry',loaves:'loaf',leaves:'leaf',biscuits:'biscuit',eggs:'egg',steaks:'steak',patties:'patty',babies:'baby',mousse:'mousse',grits:'grit',hummus:'hummus',asparagus:'asparagus',cheese:'cheese',molasses:'molasses'};
    if(special[word])return special[word];
    if(word.length > 5 && word.endsWith('ies'))return word.slice(0,-3)+'y';
    if(word.length > 4 && word.endsWith('es') && /(ses|xes|zes|ches|shes)$/.test(word))return word.slice(0,-2);
    if(word.length > 4 && word.endsWith('s') && !/(ss|us|is)$/.test(word))return word.slice(0,-1);
    return word;
  }
  function terms(title){return [...new Set(normalize(title).split(' ').filter(x=>x&&!ignored.has(x)).map(stem))];}
  const coreNouns=new Set('salad soup chowder stew chili pie cake cheesecake cookie brownie biscuit bread roll bun sauce gravy dressing dip cocktail punch lemonade tea coffee cider potato rice noodle pasta spaghetti macaroni casserole quiche omelet sandwich slider burger wing steak ribeye chicken turkey ham pork beef salmon shrimp fish lobster clam mussel oyster hotdog sausage taco nacho pudding mousse trifle pizza pancake waffle stuffing muffin'.split(' '));
  const mealProteins=new Set('beef pork chicken turkey ham shrimp salmon lobster fish crab lamb tofu duck'.split(' '));
  const flavorWarnings=new Set('coconut peanut strawberry blueberry lemon lime pumpkin coffee espresso chocolate mint cherry raspberry banana pineapple orange'.split(' '));
  function categoryGroup(category){
    const c=normalize(category);
    if(/drink|beverage|cocktail/.test(c))return 'drinks';
    if(/dessert|sweet/.test(c))return 'desserts';
    if(/bread|biscuit/.test(c))return 'breads';
    if(/salad/.test(c))return 'salad';
    if(/sauce|condiment/.test(c))return 'sauce';
    if(/main|entree/.test(c))return 'main';
    return 'other';
  }
  function createIndex(recipes){
    const items=[], byExact=new Map(), byTerm=new Map();
    for(const raw of recipes){
      if(!raw||!raw.id||!Array.isArray(raw.recipe?.steps)||!raw.recipe.steps.length||!Array.isArray(raw.recipe?.ingredients)||!raw.recipe.ingredients.length)continue;
      const allNames=[raw.title,...(Array.isArray(raw.aliases)?raw.aliases:[])].filter(Boolean);
      const titleTerms=terms(raw.title);
      const item={id:raw.id,title:raw.title,terms:titleTerms,termSet:new Set(titleTerms),group:categoryGroup(raw.category)};
      items.push(item);
      for(const title of allNames){
        const k=terms(title).join(' ');
        const normal=normalize(title);
        for(const v of [normal,k]){
          if(!v)continue;
          const arr=byExact.get(v)||[];
          if(!arr.some(a=>a.id===item.id)){arr.push(item);byExact.set(v,arr);}
        }
        for(const t of terms(title)){
          let set=byTerm.get(t);
          if(!set){set=new Set();byTerm.set(t,set);}
          set.add(item);
        }
      }
    }
    function compare(title,category){
      const normal=normalize(title),query=terms(title),qset=new Set(query);
      const group=categoryGroup(category);
      const exact=[...(byExact.get(normal)||[])].sort((a,b)=>Number(b.group===group)-Number(a.group===group));
      if(exact.length)return [{id:exact[0].id,title:exact[0].title,kind:'exact',score:1}];
      const sorted=query.slice().sort((a,b)=>(byTerm.get(a)?.size||99999)-(byTerm.get(b)?.size||99999));
      const candidates=new Set();
      for(const token of sorted.slice(0,Math.min(5,sorted.length))){
        const list=byTerm.get(token);
        if(!list)continue;
        for(const item of list)candidates.add(item);
      }
      const weight=token=>{
        const count=byTerm.get(token)?.size||0;
        return Math.max(1.2,Math.min(4.4,Math.log((items.length+5)/(count+2))/1.6));
      };
      const totalWeight=ts=>ts.reduce((s,t)=>s+weight(t),0);
      const qw=totalWeight(query);
      const found=[];
      for(const item of candidates){
        if(group==='drinks' && item.group!=='drinks')continue;
        if(group==='desserts' && ['drinks','main','sauce'].includes(item.group))continue;
        const shared=query.filter(t=>item.termSet.has(t));
        if(!shared.length)continue;
        // Preserve the main kind of dish: a salad isn't its dressing; a cake isn't frosting.
        const specific=query.filter(t=>coreNouns.has(t));
        const opposing=specific.filter(t=>!item.termSet.has(t));
        if(specific.length&&opposing.length===specific.length)continue;
        const requestedProteins=query.filter(t=>mealProteins.has(t));
        const candidateProteins=item.terms.filter(t=>mealProteins.has(t));
        if(requestedProteins.length && candidateProteins.length && !requestedProteins.some(t=>candidateProteins.includes(t)))continue;
        const intersection=totalWeight(shared);
        const cw=totalWeight(item.terms);
        let score=2*intersection/(qw+cw);
        // Prefer a complete title match, but avoid linking to a different flavored variant.
        const unexpectedFlavors=item.terms.filter(t=>flavorWarnings.has(t)&&!qset.has(t));
        score-=0.07*Math.min(2,unexpectedFlavors.length);
        if(group!=='other' && item.group!=='other' && group!==item.group){
          if(!((group==='salad'&&item.group==='main')||(group==='main'&&item.group==='salad')))score-=0.09;
        }
        score=Math.max(0,Math.min(1,score));
        if(score>=0.40){
          found.push({id:item.id,title:item.title,kind:(score>=0.64&&(shared.length>=2||query.length===1&&score>=0.85))?'related':'alternative',score:Math.round(score*1000)/1000});
        }
      }
      found.sort((a,b)=>b.score-a.score||a.title.length-b.title.length||a.title.localeCompare(b.title));
      const unique=[],seen=new Set();
      for(const candidate of found){if(seen.has(candidate.id))continue;seen.add(candidate.id);unique.push(candidate);if(unique.length>=4)break;}
      return unique;
    }
    return {find:compare,recipeCount:items.length};
  }
  window.RecipeBlueprintEventLinks={createIndex};
})();