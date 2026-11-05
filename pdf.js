'use strict';
/* Offline one-page PDF export adapted from Recipe Blueprint Studio v6.
   No network, API, external library, or browser print dialog required. */
window.RecipeBlueprintPDF = {
  export(recipe){
    if(!recipe||!Array.isArray(recipe.ingredients)||!recipe.ingredients.length)throw Error('The recipe has no ingredients.');
    const ingredients=recipe.ingredients;
    const planned=[...(recipe.steps||[])].sort((a,b)=>a.start-b.start||a.rowStart-b.rowStart);
    const total=()=>Math.max(1,...planned.map(s=>Number(s.start||0)+Number(s.duration||0)));
    const mins=m=>{m=Math.max(0,Math.round(Number(m)||0));return m>=60?Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m':m+' min';};
    const n=ingredients.length, complexity=n+planned.length;
    const W=complexity>55?1740:(n>12||complexity>30)?1200:842;
    const M=W>1000?32:25,leftW=W>1000?250:183,prepW=W>1000?102:70;
    const contentW=W-2*M,timeW=contentW-leftW-prepW;
    const rowH=W>1400?36:W>1000?39:34;
    const titleH=58,introH=recipe.intro?28:0,tickH=28,finishH=recipe.finish?27:0;
    const axisTop=M+titleH+introH,rowsTop=axisTop+tickH,rowsBottom=rowsTop+rowH*n;
    const fsize=W>1400?10.5:W>1000?9.8:8.9;
    const noteCols=W>1400?4:W>1000?3:2,colGap=11,noteW=(contentW-(noteCols-1)*colGap)/noteCols;
    function cleaned(text){return String(text??'').replace(/[¼]/g,'1/4').replace(/[½]/g,'1/2').replace(/[¾]/g,'3/4').replace(/[⅓]/g,'1/3').replace(/[⅔]/g,'2/3').replace(/[×]/g,'x').replace(/[°]/g,' degrees ').replace(/[–—−]/g,'-').replace(/[“”]/g,'"').replace(/[’]/g,"'").replace(/[•·]/g,' - ').replace(/[\r\n\t]/g,' ').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'').replace(/\s+/g,' ').trim();}
    function escapePdf(v){return cleaned(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
    function wrap(text,width,size,limit=Infinity){
      const words=cleaned(text).split(/\s+/).filter(Boolean),lines=[];let current='';
      const fit=t=>{let w=0;for(const c of t)w+=(c===' '?0.28:c==='i'||c==='l'||c==='!'||c==='.'?0.24:c==='W'||c==='M'?0.85:/[A-Z]/.test(c)?0.66:0.51)*size;return w*1.08;};
      for(const word of words){
        const candidate=current?current+' '+word:word;
        if(fit(candidate)<=width){current=candidate;continue;}
        if(current)lines.push(current);
        current='';
        if(fit(word)<=width)current=word;
        else{let part='';for(const c of word){if(fit(part+c)>width&&part){lines.push(part);part='';}part+=c;}current=part;}
        if(lines.length>=limit)break;
      }
      if(current&&lines.length<limit)lines.push(current);
      return lines.length?lines:[''];
    }
    const noteFont=W>1000?9.3:8.1,noteLine=noteFont*1.4;
    const notes=planned.map((s,i)=>{
      const head=(i+1)+'. '+s.title+' ('+mins(s.duration)+')';
      const body=String(s.details||'').trim()||s.title;
      const lines=wrap(head+'. '+body,noteW-15,noteFont,90);
      return {lines,height:Math.max(noteLine*2,lines.length*noteLine+10)};
    });
    const noteRows=[];
    for(let i=0;i<notes.length;i+=noteCols){const batch=notes.slice(i,i+noteCols);noteRows.push({batch,height:Math.max(...batch.map(x=>x.height))});}
    const notesTop=rowsBottom+finishH+12;
    const notesH=notes.length?29+noteRows.reduce((v,x)=>v+x.height,0)+12:0;
    const H=Math.max(W>1000?(W>1400?1150:805):595,Math.ceil(notesTop+notesH+M+14));
    const cmd=[];
    const rgb=h=>{h=h.replace('#','');return [0,2,4].map(i=>(parseInt(h.slice(i,i+2),16)/255).toFixed(3)).join(' ');};
    const rect=(x,y,w,h,fill='#ffffff',stroke='#a8c0d8',lw=.55)=>{if(w<=0||h<=0)return;cmd.push(`${rgb(fill)} rg ${rgb(stroke)} RG ${lw.toFixed(2)} w ${x.toFixed(2)} ${(H-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B`);};
    const line=(x1,y1,x2,y2,color='#b7cada',lw=.4)=>cmd.push(`${rgb(color)} RG ${lw.toFixed(2)} w ${x1.toFixed(2)} ${(H-y1).toFixed(2)} m ${x2.toFixed(2)} ${(H-y2).toFixed(2)} l S`);
    const txt=(x,y,value,size=9,color='#243c59',bold=false,angle=0)=>{
      if(value===undefined||value===null||value==='')return;
      const rad=angle*Math.PI/180,a=Math.cos(rad).toFixed(5),b=Math.sin(rad).toFixed(5),c=(-Math.sin(rad)).toFixed(5),d=Math.cos(rad).toFixed(5);
      cmd.push(`BT /${bold?'F2':'F1'} ${size.toFixed(2)} Tf ${rgb(color)} rg ${a} ${b} ${c} ${d} ${x.toFixed(2)} ${(H-y-size*.82).toFixed(2)} Tm (${escapePdf(value)}) Tj ET`);
    };
    function lines(x,y,value,width,size,color='#253a55',bold=false,maxLines=5,leading=1.2){
      const arr=wrap(value,width,size,maxLines);arr.forEach((a,i)=>txt(x,y+i*size*leading,a,size,color,bold));return arr.length*size*leading;
    }
    rect(0,0,W,H,'#ffffff','#ffffff',0);
    txt(M,M,recipe.title||'Untitled recipe',W>1000?22:20,'#173e71',true);
    txt(M,M+27,[recipe.yield||'Recipe',mins(total())+' elapsed',planned.length+' timed steps'].join('   |   '),10,'#698098');
    txt(W-M-145,M+28,'RECIPE BLUEPRINT',8.3,'#6184b2',true);
    if(recipe.intro){rect(M,M+titleH,contentW,introH,'#edf4fc','#aec7e0');lines(M+9,M+titleH+6,'GET READY: '+recipe.intro,contentW-18,9.1,'#2f557c',false,2);}
    rect(M,axisTop,leftW,tickH,'#e5effb','#85a8cf');rect(M+leftW,axisTop,prepW,tickH,'#e5effb','#85a8cf');rect(M+leftW+prepW,axisTop,timeW,tickH,'#e5effb','#85a8cf');
    txt(M+8,axisTop+9,'INGREDIENTS / AMOUNTS',9,'#214d80',true);txt(M+leftW+5,axisTop+9,'PREP',9,'#214d80',true);
    const tmax=total(),tx=M+leftW+prepW,tick=tmax>180?30:tmax>90?15:tmax>40?10:5;
    for(let t=0;t<=tmax;t+=tick){const x=tx+timeW*t/tmax;if(x<tx+timeW-25)txt(x+3,axisTop+9,t+'m',8,'#315b86',true);}
    for(let r=0;r<n;r++){
      const y=rowsTop+r*rowH,ing=ingredients[r];
      rect(M,y,leftW,rowH,r%2?'#f6faff':'#ffffff','#96b3d1');rect(M+leftW,y,prepW,rowH,'#f5f8fc','#96b3d1');rect(tx,y,timeW,rowH,'#ffffff','#c0d0df');
      lines(M+7,y+5,[ing.amount,ing.name].filter(Boolean).join(' '),leftW-14,W>1000?10:9.5,'#172e48',false,Math.max(1,Math.floor((rowH-8)/((W>1000?10:9.5)*1.17))),1.17);
      lines(M+leftW+5,y+7,ing.prep||'',prepW-10,W>1000?9:8,'#506c88',false,3);
    }
    for(let t=tick;t<tmax;t+=tick){const x=tx+timeW*t/tmax;line(x,rowsTop,x,rowsBottom,'#edf1f5',.35);}
    planned.forEach((s,i)=>{
      const x=tx+timeW*s.start/tmax,y=rowsTop+rowH*s.rowStart,w=Math.min(timeW-(x-tx),timeW*s.duration/tmax),h=rowH*(s.rowEnd-s.rowStart+1);
      const bg=s.kind==='heat'?'#dcecfb':s.kind==='passive'?'#edf0f4':'#e7f2ff';
      const edge=s.kind==='heat'?'#6e96c0':s.kind==='passive'?'#acb8c5':'#87aad0';
      rect(x,y,w,h,bg,edge,.85);const label=(i+1)+'. '+s.title;
      if(w>=54){const max=Math.max(1,Math.floor((h-15)/11));lines(x+4,y+5,label,w-8,Math.min(10.2,fsize),'#214464',true,max,1.15);if(h>=34)txt(x+4,y+h-12,mins(s.duration),7.3,'#527494');}
      else if(w>=22){
        const fs=Math.min(9,fsize),verticalLabel=cleaned(label),estimatedLength=verticalLabel.length*fs*.59;
        if(h>=110&&estimatedLength<=h-18)txt(x+w/2+fs*.30,y+h-8,verticalLabel,fs,'#214464',true,90);
        else{const num=String(i+1),numSize=Math.min(12,Math.max(8,w*.31));txt(x+(w-numSize*.6*num.length)/2,y+h/2-numSize/2,num,numSize,'#214464',true);if(w>=31&&h>=52)txt(x+3,y+h-13,mins(s.duration),7,'#567697');}
      }else if(w>=7)txt(x+1,y+Math.min(h/2,16),String(i+1),Math.min(8.4,Math.max(5.5,w-2)),'#214464',true);
    });
    if(recipe.finish){rect(M,rowsBottom,contentW,finishH,'#eef5fd','#a4c0de');lines(M+8,rowsBottom+6,'FINISH: '+recipe.finish,contentW-16,8.7,'#365b7f',false,2);}
    if(notes.length){
      rect(M,notesTop,contentW,23,'#dce9f8','#a1bad5');txt(M+9,notesTop+7,'STEP-BY-STEP DIRECTIONS',10.2,'#1c4b7e',true);
      let yy=notesTop+23;
      for(const row of noteRows){let xx=M;row.batch.forEach(info=>{rect(xx,yy,noteW,row.height,'#fcfdff','#d3deeb',.3);info.lines.forEach((v,k)=>{if(k*noteLine+noteLine<row.height+1)txt(xx+6,yy+5+k*noteLine,v,noteFont,k===0?'#244b77':'#3b536f',k===0);});xx+=noteW+colGap;});yy+=row.height;}
    }
    txt(M,H-M+5,'Time widths are proportional to elapsed minutes. Steps can overlap only on independent ingredient rows.',8.1,'#7e90a4');
    const stream=cmd.join('\n')+'\n';
    const objects=[
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    ];
    let pdf='%PDF-1.4\n%Recipe Blueprint\n',offsets=[0];
    objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
    const at=pdf.length;pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
    offsets.slice(1).forEach(v=>pdf+=String(v).padStart(10,'0')+' 00000 n \n');
    pdf+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+at+'\n%%EOF\n';
    const bytes=Uint8Array.from(pdf,ch=>ch.charCodeAt(0));
    const blob=new Blob([bytes],{type:'application/pdf'});
    const name=(recipe.title||'recipe').replace(/[^a-z0-9._-]+/gi,'_')+'_one_page.pdf';
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
};