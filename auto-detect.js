'use strict';
/* ExamForge auto-detect v1.
   Reads selectable PDF text solely to find question boundaries.
   Every exported question remains an image of the ORIGINAL PDF (equations intact).
   Never invents answers; flags uncertain crops for manual checking.
*/
(function(root){
 const limit=(x,a,b)=>Math.min(b,Math.max(a,x));
 const HEADERS=/^(?:physics|chemistry|mathematics|maths|section\s+[a-e]|part\s+[a-d])(?:\s*[-:–].*)?$/i;
 const numbered=/^\s*(?:Q(?:uestion)?\s*\.?\s*(?:No\.?\s*|Number\s*)?|Que\.?\s*)(\d{1,3})\s*[).:\-]?\s*(.*)$/i;
 const nta=/\bQuestion\s*(?:Number|No\.?|ID)\s*[:：=.\-]?\s*(\d{1,3})\b/i;
 const bare=/^\s*(\d{1,3})\s*[.)]\s+(\S.{2,})$/;
 function classify(line){
   const s=String(line||'').replace(/\s+/g,' ').trim();
   if(!s||s.length>500||/^(?:answer|solution|page\s*\d)/i.test(s))return null;
   let m=nta.exec(s);
   if(m && +m[1]>=1 && +m[1]<=300)return {number:+m[1],confidence:'high',style:'nta'};
   m=numbered.exec(s);
   if(m && +m[1]>=1 && +m[1]<=300)return {number:+m[1],confidence:'high',style:'label'};
   m=bare.exec(s);
   if(m && +m[1]>=1 && +m[1]<=300 && !/^(?:[a-d][).]|option)\b/i.test(m[2]))
     return {number:+m[1],confidence:'medium',style:'numbered'};
   return null;
 }
 function joinNearLines(lines){
   const sorted=[...lines].sort((a,b)=>a.y-b.y||a.x-b.x);
   const extra=[];
   // PDF.js often emits "Question", "Number :", "12" as separate lines/items.
   // Rejoin only short, nearby line fragments to avoid merging a whole paragraph.
   for(let i=0;i<sorted.length;i++){
     const first=sorted[i],one=first.text.trim();
     if(!/^(?:Q(?:uestion)?|Que\.?|Question\s*(?:Number|No\.?|ID)|\d{1,3}\s*[.)]?)$/i.test(one))continue;
     let combined=one;
     for(let j=i+1;j<Math.min(sorted.length,i+4);j++){
       const next=sorted[j],distance=next.y-first.y;
       if(distance<-.5||distance>40||Math.abs(next.x-first.x)>Math.max(85,first.pageWidth*.2))break;
       combined+=' '+next.text.trim();
       const result=classify(combined);
       if(result && result.confidence==='high'){
         extra.push({...first,text:combined,compound:true});
         break;
       }
     }
   }
   return extra;
 }
 function getLines(content,viewport,lib){
   const rows=[];
   for(const item of content.items||[]){
     const str=String(item.str||'').replace(/\s+/g,' ').trim();
     if(!str)continue;
     const m=lib.Util.transform(viewport.transform,item.transform);
     const x=m[4],y=m[5],w=Math.max(0,Math.abs(item.width||0)*viewport.scale);
     if(!Number.isFinite(x)||!Number.isFinite(y))continue;
     rows.push({str,x,y,w,h:Math.max(7,Math.abs(m[3])||10)});
   }
   rows.sort((a,b)=>a.y-b.y||a.x-b.x);
   const groups=[];
   for(const t of rows){
     let g=groups[groups.length-1];
     if(!g||Math.abs(g.y-t.y)>Math.max(3,Math.min(6,t.h*.38))){
       g={y:t.y,parts:[]};groups.push(g);
     }
     g.parts.push(t);
   }
   const lines=[];
   for(const group of groups){
     group.parts.sort((a,b)=>a.x-b.x);
     // Two-column pages can have text at same Y; split on substantial horizontal gaps.
     const segments=[];let segment=[];
     for(const item of group.parts){
       const prev=segment[segment.length-1];
       if(prev && item.x-(prev.x+prev.w)>Math.max(38,viewport.width*.13)){
         segments.push(segment);segment=[];
       }
       segment.push(item);
     }
     if(segment.length)segments.push(segment);
     for(const parts of segments){
       lines.push({text:parts.map(x=>x.str).join(' '),x:parts[0].x,
         y:Math.min(...parts.map(x=>x.y)),right:Math.max(...parts.map(x=>x.x+x.w)),
         pageWidth:viewport.width,pageHeight:viewport.height,
         parts:parts.map(x=>({text:x.str,x:x.x,y:x.y,w:x.w}))});
     }
   }
   return lines;
 }
 function detectPage(lines,pageNumber){
   const joined=joinNearLines(lines);
   const anchors=[],subjects=[],standalone=[];
   const add=(found,l,raw)=>{
     if(!found||l.y<18||l.y>l.pageHeight-16||l.x>l.pageWidth*.83)return;
     anchors.push({...found,page:pageNumber,y:l.y,x:l.x,raw,
       height:l.pageHeight,width:l.pageWidth});
   };
   for(const l of [...lines,...joined]){
     const trimmed=l.text.trim();
     if(HEADERS.test(trimmed))subjects.push({y:l.y,label:trimmed});
     add(classify(trimmed),l,trimmed);
     // A PDF may put Q4, Q5 and Q6 into one joined text row. Recover actual
     // marker positions from PDF.js text fragments, instead of silently joining.
     for(const part of l.parts||[]){
       const piece=part.text.trim(),found=classify(piece);
       if(found)add(found,{...l,x:part.x,y:part.y},piece);
     }
     if(!l.compound){
       // Some exam PDFs render the label "5." on its own line, followed by
       // the question text on the next line. This was making Q4 swallow Q5/Q6.
       const m=/^(\d{1,3})\s*([.)])\s*$/.exec(trimmed);
       if(m&&+m[1]>=1&&+m[1]<=75&&l.x<l.pageWidth*.65)
         standalone.push({number:+m[1],confidence:'low',style:'standalone',
           page:pageNumber,y:l.y,x:l.x,raw:trimmed,
           height:l.pageHeight,width:l.pageWidth});
     }
   }
   anchors.sort((a,b)=>a.y-b.y||a.x-b.x);
   const deduped=[];
   for(const a of anchors){
     if(deduped.some(x=>x.number===a.number&&Math.abs(x.y-a.y)<13&&Math.abs(x.x-a.x)<25))continue;
     deduped.push(a);
   }
   return {page:pageNumber,anchors:deduped,standalone,subjects,lineCount:lines.length,compoundMatches:joined.length};
 }
 function planPages(pages){
   const result=[],warnings=[];
   const known=new Set(pages.flatMap(p=>(p.anchors||[]).map(a=>a.number)));
   const missing=new Set(Array.from({length:75},(_,i)=>i+1).filter(n=>!known.has(n)));
   const solo=pages.flatMap(p=>p.standalone||[]);
   // Recover isolated "5." / "6." markers only when they're plausible missing
   // questions within a sequence of actual numbered questions. Flag each one.
   const byNumber=new Map();
   for(const a of solo){
     if(!missing.has(a.number))continue;
     if(!byNumber.has(a.number))byNumber.set(a.number,[]);
     byNumber.get(a.number).push(a);
   }
   const recovered=[];
   for(const [num,options] of byNumber){
     if(options.length!==1)continue; // ambiguous repeated number
     const prev=known.has(num-1)||byNumber.has(num-1);
     const next=known.has(num+1)||byNumber.has(num+1);
     if(!prev&&!next)continue;
     const a=options[0];
     const samePage=pages.find(p=>p.page===a.page)?.anchors||[];
     const aligned=samePage.length===0||samePage.some(b=>Math.abs(b.x-a.x)<Math.max(55,a.width*.14));
     if(!aligned)continue;
     recovered.push({...a,confidence:'low',recovered:true});
   }
   const recoveredByPage=new Map();
   for(const a of recovered){
     if(!recoveredByPage.has(a.page))recoveredByPage.set(a.page,[]);
     recoveredByPage.get(a.page).push(a);
   }
   if(recovered.length)warnings.push('Recovered '+recovered.length+' standalone question numbers. Review these crops carefully before testing.');

   for(const page of pages){
     if(page.error){warnings.push('Page '+page.page+': '+page.error);continue;}
     if(page.lineCount<6&&!page.anchors?.length)warnings.push('Page '+page.page+': little selectable text and no question markers. Scanned PDFs may need OCR.');
     const anchors=[...(page.anchors||[]),...(recoveredByPage.get(page.page)||[])];
     // Detect two-column sheets only if both halves contain multiple question anchors.
     const left=anchors.filter(a=>a.x<a.width*.49),right=anchors.filter(a=>a.x>=a.width*.49);
     const twoCol=left.length>=2&&right.length>=2;
     const ordered=twoCol?
       [...left.sort((a,b)=>a.y-b.y),...right.sort((a,b)=>a.y-b.y)]:
       [...anchors].sort((a,b)=>a.y-b.y||a.x-b.x);
     for(let i=0;i<ordered.length;i++){
       const a=ordered[i];const isRight=twoCol&&a.x>=a.width*.49;
       const next=ordered.slice(i+1).find(b=>!twoCol||(b.x>=b.width*.49)===isRight);
       const top=limit((a.y-18)/a.height,.005,.96);
       const bottom=next?limit((next.y-21)/a.height,top+.015,.98):.95;
       const x=twoCol?(isRight?.51:.035):.035, width=twoCol?.455:.93;
       const rect={page:page.page,x,y:top,w:width,h:Math.max(.015,bottom-top)};
       const flags=[];
       if(a.confidence!=='high')flags.push(a.recovered?'Recovered standalone number — check entire question and options':'Weak question marker');
       if(!next)flags.push('Last question in page/column: check page-break continuation');
       if(rect.h<.055)flags.push('Unusually short crop');
       if(rect.h>.75)flags.push('Unusually long crop');
       if(a.y<a.height*.045)flags.push('Question near page header');
       result.push({printedNumber:a.number,rect,flags,raw:a.raw,page:page.page});
     }
   }
   if(!result.length)warnings.push('No question headings identified. Try a text-selectable PDF with Q-number or Question Number labels.');
   const seen=new Set();
   for(const item of result){
     const key=item.printedNumber;
     if(seen.has(key))item.flags.push('Printed question number repeats; verify sequence and subject');
     seen.add(key);
   }
   const numeric=result.map(x=>x.printedNumber);
   const unique=new Set(numeric);
   const fullSequence=unique.size===numeric.length&&numeric.every(n=>n>=1&&n<=75);
   const missingNumbers=fullSequence?Array.from({length:75},(_,i)=>i+1).filter(n=>!unique.has(n)):[];
   if(result.length!==75){
     warnings.push('Detected '+result.length+' candidates, not 75. Review missed/extra boundaries.');
     if(missingNumbers.length)warnings.unshift('Missing printed question numbers: '+missingNumbers.join(', '));
     else if(numeric.length&&unique.size<numeric.length)
       warnings.unshift('Printed question numbers repeat (possibly reset by subject). Check missing questions by page and subject, not only number.');
   }
   const emptyPages=pages.filter(p=>!p.error&&(!p.anchors||!p.anchors.length));
   if(emptyPages.length)warnings.push('Pages with no detected question heading: '+emptyPages.map(p=>p.page).join(', ')+'. Some may contain continuations; inspect them.');
   return {candidates:result,warnings,missingNumbers:missingNumbers,pagesWithoutHeadings:emptyPages.map(p=>p.page),recoveredCount:recovered.length};
 }
 root.ExamForgeAutoDetect=Object.freeze({classify,getLines,detectPage,planPages});
})(window);
