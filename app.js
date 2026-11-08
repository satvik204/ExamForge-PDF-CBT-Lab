'use strict';
/* ExamForge PDF→CBT Lab: local visual cropping, answer entry, CBT and portable EF1. */
const $=id=>document.getElementById(id);
const S={doc:null,page:1,zoom:1.25,questions:[],select:null,drag:null,edit:-1,exam:null,code:'',timer:null,rendering:false};
const notify=msg=>{const x=$('status');x.textContent=msg;x.style.display='block';clearTimeout(notify.t);notify.t=setTimeout(()=>x.style.display='none',5000)};
const setTab=name=>{document.querySelectorAll('.step').forEach(e=>e.classList.toggle('active',e.dataset.tab===name));document.querySelectorAll('.view').forEach(e=>e.classList.toggle('active',e.id==='tab-'+name));if(name==='crop'&&S.doc)drawPage();if(name==='answers')renderAnswers();if(name==='exam')examSetup();if(name==='export')exportInfo()};
document.querySelectorAll('.step').forEach(x=>x.onclick=()=>setTab(x.dataset.tab));
$('helpBtn').onclick=()=>$('helpDialog').showModal();
$('helpClose').onclick=()=>$('helpDialog').close();
async function importPdf(file){
 if(!file||!(/\.pdf$/i.test(file.name)||file.type==='application/pdf'))return notify('Choose a PDF.');
 if(file.size>60*1024*1024)return notify('Maximum PDF size is 60 MB.');
 if(!window.pdfjsLib)return notify('PDF.js is unavailable. Check your internet.');
 if(S.questions.length&&!confirm('Loading a new PDF removes existing crops. Continue?'))return;
 try{
  const b=new Uint8Array(await file.arrayBuffer());
  if(String.fromCharCode(...b.slice(0,5))!=='%PDF-')throw Error('This is not a PDF.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc=await pdfjsLib.getDocument({data:b}).promise;
  if(doc.numPages>250)throw Error('Maximum 250 PDF pages.');
  if(S.doc)await S.doc.destroy().catch(()=>{});
  S.doc=doc;S.page=1;S.zoom=1.25;S.questions=[];S.select=null;S.edit=-1;S.code='';S.exam=null;
  $('testTitle').value=file.name.replace(/\.pdf$/i,'').replace(/[_-]/g,' ').slice(0,140);
  $('exportOutput').value='';$('copyCode').disabled=true;$('downloadCode').disabled=true;
  updateCount();renderSaved();setTab('crop');notify('PDF loaded: '+doc.numPages+' pages.');
 }catch(e){notify('Cannot load PDF: '+e.message);console.error(e)}
}
$('pdfInput').onchange=e=>{importPdf(e.target.files[0]);e.target.value=''};
const drop=$('dropZone');
drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};
drop.ondragleave=()=>drop.classList.remove('drag');
drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');importPdf(e.dataTransfer.files[0])};
async function drawPage(){
 if(!S.doc||S.rendering)return;
 S.rendering=true;
 try{
  const page=await S.doc.getPage(S.page),v=page.getViewport({scale:S.zoom}),canvas=$('pdfCanvas');
  canvas.width=Math.round(v.width);canvas.height=Math.round(v.height);
  await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;
  $('cropOverlay').style.width=canvas.width+'px';$('cropOverlay').style.height=canvas.height+'px';
  $('pageLabel').textContent='Page '+S.page+' / '+S.doc.numPages;
  $('zoomLabel').textContent=Math.round(S.zoom*100)+'%';
  $('pdfEmpty').style.display='none';drawBox();
 }catch(e){notify('PDF rendering failed: '+e.message);console.error(e)}
 finally{S.rendering=false}
}
const pageTo=n=>{if(!S.doc)return;S.page=Math.max(1,Math.min(S.doc.numPages,n));S.select=null;drawBox();drawPage()};
$('prevPage').onclick=()=>pageTo(S.page-1);$('nextPage').onclick=()=>pageTo(S.page+1);
$('zoomIn').onclick=()=>{S.zoom=Math.min(3,S.zoom+.25);drawPage()};
$('zoomOut').onclick=()=>{S.zoom=Math.max(.5,S.zoom-.25);drawPage()};
const overlay=$('cropOverlay');
const position=e=>{const r=overlay.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}};
const boxFrom=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y),page:S.page});
function drawBox(){const box=$('cropBox'),s=S.select;if(!s||s.page!==S.page){box.hidden=true;return}box.hidden=false;Object.assign(box.style,{left:s.x*100+'%',top:s.y*100+'%',width:s.w*100+'%',height:s.h*100+'%'})}
overlay.onpointerdown=e=>{if(!S.doc||e.button!==0)return;S.drag=position(e);S.select={...S.drag,w:0,h:0,page:S.page};overlay.setPointerCapture(e.pointerId);drawBox()};
overlay.onpointermove=e=>{if(!S.drag)return;S.select=boxFrom(S.drag,position(e));drawBox()};
overlay.onpointerup=async e=>{if(!S.drag)return;S.select=boxFrom(S.drag,position(e));S.drag=null;drawBox();if(S.select.w<.018||S.select.h<.008){S.select=null;drawBox();return notify('Crop is too small.')}await preview()};
overlay.onpointercancel=()=>{S.drag=null};
async function extractCrop(crop,scale=1.7){
 if(!S.doc)throw Error('Upload a PDF first.');
 const page=await S.doc.getPage(crop.page),v=page.getViewport({scale:1});
 const rawW=v.width*crop.w,rawH=v.height*crop.h;
 const factor=Math.min(scale,1900/rawW,2300/rawH);
 const size=page.getViewport({scale:factor}),can=document.createElement('canvas');
 can.width=Math.max(1,Math.ceil(rawW*factor));can.height=Math.max(1,Math.ceil(rawH*factor));
 const ctx=can.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,can.width,can.height);
 ctx.save();ctx.translate(-crop.x*size.width,-crop.y*size.height);
 await page.render({canvasContext:ctx,viewport:size}).promise;ctx.restore();
 return can.toDataURL('image/jpeg',.84);
}
async function preview(){try{const img=new Image();img.src=await extractCrop(S.select,1.3);img.alt='Cropped question preview';$('cropPreview').replaceChildren(img);$('saveCrop').disabled=false}catch(e){notify(e.message)}}
function nextNum(){return S.questions.length?Math.max(...S.questions.map(q=>q.num))+1:1}
function typeChanged(){$('qMetaSingle').hidden=$('qType').value!=='single';$('qMetaNumber').hidden=$('qType').value!=='numerical'}
$('qType').onchange=typeChanged;
function resetEditor(){S.select=null;S.edit=-1;drawBox();$('cropPreview').textContent='Draw a box on the PDF to preview the crop.';$('saveCrop').disabled=true;$('modePill').textContent='New crop';$('cancelEdit').hidden=true;$('qNumber').value=nextNum()}
$('cancelEdit').onclick=resetEditor;
$('saveCrop').onclick=async()=>{
 if(!S.select)return notify('Draw a rectangle first.');
 const num=Number($('qNumber').value),type=$('qType').value;
 if(!Number.isInteger(num)||num<1||num>300)return notify('Invalid question number.');
 if(S.questions.some((q,i)=>q.num===num&&i!==S.edit))return notify('Question number already exists.');
 const value=type==='single'?$('qAnswerSingle').value:$('qAnswerNumber').value.trim();
 const answer=value===''?null:type==='single'?value:Number(value);
 try{
  const image=await extractCrop(S.select,1.8);
  const item={num,subject:$('qSubject').value,type,answer,rect:{...S.select},image};
  if(S.edit<0)S.questions.push(item);else S.questions[S.edit]=item;
  S.questions.sort((a,b)=>a.num-b.num);
  invalidateCode();resetEditor();renderSaved();notify('Saved question '+num);
 }catch(e){notify('Cannot save crop: '+e.message)}
};
function invalidateCode(){S.code='';$('exportOutput').value='';$('copyCode').disabled=true;$('downloadCode').disabled=true}
function updateCount(){$('sideCount').textContent=S.questions.length+' questions';$('savedCount').textContent=S.questions.length;$('progressBar').style.width=Math.min(100,S.questions.length/75*100)+'%'}
function renderSaved(){
 updateCount();const host=$('savedQuestions');host.replaceChildren();
 if(!S.questions.length){host.textContent='No saved questions yet.';return}
 for(const [i,q] of S.questions.entries()){
  const row=document.createElement('div');row.className='saved-row';
  const image=new Image();image.src=q.image;image.alt='Question '+q.num;
  const body=document.createElement('div');body.className='saved-body';
  const title=document.createElement('strong');title.textContent='Q'+q.num+' · '+q.subject;
  const sub=document.createElement('small');sub.textContent='Page '+q.rect.page+' · '+(q.answer===null?'Answer missing':'Answer: '+q.answer);body.append(title,sub);
  const edit=document.createElement('button');edit.className='subtle';edit.textContent='Recrop';edit.onclick=async()=>{
   S.edit=i;S.page=q.rect.page;S.select={...q.rect};
   $('qNumber').value=q.num;$('qSubject').value=q.subject;$('qType').value=q.type;typeChanged();
   $('qAnswerSingle').value=q.type==='single'?(q.answer??''):'';
   $('qAnswerNumber').value=q.type==='numerical'?(q.answer??''):'';
   $('modePill').textContent='Editing Q'+q.num;$('cancelEdit').hidden=false;
   await drawPage();await preview();
  };
  const remove=document.createElement('button');remove.className='subtle';remove.textContent='×';remove.title='Delete crop';remove.onclick=()=>{
   if(!confirm('Delete Q'+q.num+'?'))return;
   S.questions=S.questions.filter(x=>x!==q);invalidateCode();renderSaved();resetEditor();
  };
  row.append(image,body,edit,remove);host.append(row);
 }
}
function renderAnswers(){
 const host=$('answerRows');host.replaceChildren();
 for(const q of S.questions){
  const row=document.createElement('div');row.className='saved-row';
  const label=document.createElement('div');label.className='saved-body';label.textContent='Q'+q.num+' · '+q.subject+' · '+(q.type==='single'?'MCQ':'Numerical');
  let input;if(q.type==='single'){input=document.createElement('select');for(const [v,t] of [['','Missing'],['A','A'],['B','B'],['C','C'],['D','D']])input.add(new Option(t,v));input.value=q.answer??''}
  else{input=document.createElement('input');input.type='number';input.step='any';input.value=q.answer??'';input.placeholder='Verified numerical answer'}
  input.className='answer-input';input.dataset.question=q.num;row.append(label,input);host.append(row);
 }
 answerStats();
}
function answerStats(){$('answerStats').textContent=S.questions.filter(q=>q.answer!==null&&q.answer!=='').length+' / '+S.questions.length+' answered'}
function saveAnswers(){
 for(const el of document.querySelectorAll('.answer-input')){
  const q=S.questions.find(q=>q.num===Number(el.dataset.question));
  if(q)q.answer=el.value===''?null:q.type==='single'?el.value:Number(el.value);
 }
 invalidateCode();answerStats();notify('Answers saved for this browser tab.');
}
$('saveAnswers').onclick=saveAnswers;
$('validateAnswers').onclick=()=>{
 saveAnswers();const missing=S.questions.filter(q=>q.answer===null).map(q=>'Q'+q.num);
 $('validationBox').textContent=missing.length?'Missing: '+missing.join(', '):'All answer fields filled. You must still verify each against the official key.';
};
function examSetup(){$('examInfo').textContent='Questions: '+S.questions.length+' · Answers entered: '+S.questions.filter(q=>q.answer!==null).length+' · Duration '+($('examMinutes').value||180)+' min';$('startExam').disabled=!S.questions.length}
$('startExam').onclick=()=>{
 if(!S.questions.length)return notify('Crop questions first.');
 if(S.exam&&!confirm('Restart the exam?'))return;
 S.exam={started:Date.now(),seconds:Math.max(1,Math.min(300,Number($('examMinutes').value)||180))*60,index:0,responses:{},review:new Set(),visited:new Set(),zoom:1,ended:false};
 $('examSetup').hidden=true;$('examRunning').hidden=false;$('examReport').hidden=true;
 clearInterval(S.timer);S.timer=setInterval(tick,400);showQuestion();tick();
};
function tick(){
 const e=S.exam;if(!e||e.ended)return;
 const remaining=Math.max(0,e.seconds-Math.floor((Date.now()-e.started)/1000));
 $('timer').textContent=[Math.floor(remaining/3600),Math.floor(remaining%3600/60),remaining%60].map(v=>String(v).padStart(2,'0')).join(':');
 if(remaining===0)finish(true);
}
const current=()=>S.questions[S.exam.index];
function showQuestion(){
 if(!S.exam)return;
 const e=S.exam,q=current();e.visited.add(q.num);
 $('examHeading').textContent=$('testTitle').value||'PDF CBT';
 $('cbtQuestionLabel').textContent='Question '+q.num+' of '+S.questions.length+' · '+q.subject;
 $('cbtQuestionType').textContent=q.type==='single'?'MCQ':'Numerical';
 $('cbtImage').src=q.image;$('cbtImage').style.width=e.zoom*100+'%';
 $('cbtZoomLabel').textContent=Math.round(e.zoom*100)+'%';
 const choices=$('cbtChoices');choices.replaceChildren();
 if(q.type==='single'){
  for(const v of ['A','B','C','D']){
   const label=document.createElement('label'),input=document.createElement('input');
   input.type='radio';input.name='response';input.value=v;input.checked=e.responses[q.num]===v;
   input.onchange=()=>{e.responses[q.num]=v;showPalette()};label.append(input,document.createTextNode('Option '+v));choices.append(label);
  }
 }else{
  const input=document.createElement('input');input.type='number';input.step='any';input.placeholder='Numerical answer';
  input.value=e.responses[q.num]??'';input.oninput=()=>{e.responses[q.num]=input.value;showPalette()};choices.append(input);
 }
 $('cbtReview').textContent=e.review.has(q.num)?'Unmark review':'Mark for review';showPalette();
}
function showPalette(){
 const e=S.exam;if(!e)return;
 const host=$('cbtPalette');host.replaceChildren();let answered=0;
 for(const [i,q] of S.questions.entries()){
  const v=e.responses[q.num],has=v!==undefined&&v!==null&&v!=='';
  if(has)answered++;
  const b=document.createElement('button');b.textContent=q.num;
  if(has)b.classList.add('answered');if(e.review.has(q.num))b.classList.add('review');if(i===e.index)b.classList.add('current');
  b.onclick=()=>{e.index=i;showQuestion()};host.append(b);
 }
 $('paletteStats').textContent='Answered '+answered+'/'+S.questions.length+' · Review '+e.review.size;
}
$('cbtPrev').onclick=()=>{S.exam.index=Math.max(0,S.exam.index-1);showQuestion()};
$('cbtNext').onclick=()=>{S.exam.index=Math.min(S.questions.length-1,S.exam.index+1);showQuestion()};
$('cbtClear').onclick=()=>{delete S.exam.responses[current().num];showQuestion()};
$('cbtReview').onclick=()=>{const q=current().num;S.exam.review.has(q)?S.exam.review.delete(q):S.exam.review.add(q);showQuestion()};
$('cbtZoomIn').onclick=()=>{S.exam.zoom=Math.min(3,S.exam.zoom+.25);showQuestion()};
$('cbtZoomOut').onclick=()=>{S.exam.zoom=Math.max(.5,S.exam.zoom-.25);showQuestion()};
$('submitExam').onclick=()=>{if(confirm('Submit now?'))finish(false)};
function finish(timed){
 const e=S.exam;if(!e||e.ended)return;e.ended=true;clearInterval(S.timer);
 $('examRunning').hidden=true;$('examReport').hidden=false;
 const correct=Number($('correctMarks').value)||4,wrong=Number($('wrongMarks').value);
 let attempted=0,right=0,bad=0,unscored=0,points=0;
 for(const q of S.questions){
  const v=e.responses[q.num];if(v===undefined||v==='')continue;attempted++;
  if(q.answer===null){unscored++;continue}
  if(q.type==='single'?v===q.answer:Math.abs(Number(v)-Number(q.answer))<=.001){right++;points+=correct}
  else{bad++;points+=Number.isFinite(wrong)?wrong:-1}
 }
 const host=$('reportContent');host.replaceChildren();
 const info=document.createElement('p');info.textContent=(timed?'Time expired. ':'')+'Answered '+attempted+'/'+S.questions.length;
 const cards=document.createElement('div');cards.className='stat-report';
 for(const [name,value] of [['Score',points],['Correct',right],['Incorrect',bad],['Unscored',unscored]]){
  const card=document.createElement('div'),v=document.createElement('b'),label=document.createElement('small');
  v.textContent=value;label.textContent=name;card.append(v,label);cards.append(card);
 }
 const note=document.createElement('p');note.className='hint';note.textContent='Provisional score, depending on the correctness of your entered answer key.';
 host.append(info,cards,note);
}
$('resetExam').onclick=()=>{$('examReport').hidden=true;$('examSetup').hidden=false;S.exam=null;examSetup()};
function normalize(){
 if(!S.questions.length)throw Error('Crop a question first.');
 const un=S.questions.filter(q=>q.answer===null);if(un.length)throw Error('Missing answers for '+un.map(q=>'Q'+q.num).join(', '));
 const duration=Number($('examMinutes').value),correct=Number($('correctMarks').value),wrong=Number($('wrongMarks').value);
 if(!(duration>=1&&duration<=300))throw Error('Duration must be 1–300 minutes.');
 if(!(correct>=0&&correct<=20&&wrong<=0&&wrong>=-20))throw Error('Invalid marking values.');
 return {version:1,title:($('testTitle').value||'PDF CBT').slice(0,140),durationMinutes:duration,marking:{correct,wrong},
 questions:S.questions.map(q=>({id:'Q'+q.num,subject:q.subject,type:q.type,text:'See original question image',image:q.image,
 options:q.type==='single'?['A','B','C','D']:[],answer:q.answer,tolerance:.001,marks:correct,negativeMarks:wrong,bonus:false}))};
}
function ef1(pack){
 const bytes=new TextEncoder().encode(JSON.stringify(pack));let str='';
 for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return 'EF1:'+btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function exportInfo(){$('exportInfo').textContent='Crops: '+S.questions.length+' · Keyed: '+S.questions.filter(q=>q.answer!==null).length+'. Image-embedded EF1 codes can exceed room size limits.'}
$('generateCode').onclick=()=>{
 try{
  const pack=normalize(),json=JSON.stringify(pack);
  if(json.length>900000)throw Error('The 900 KB ExamForge code limit was exceeded. Export fewer questions.');
  S.code=ef1(pack);$('exportOutput').value=S.code;$('copyCode').disabled=false;$('downloadCode').disabled=false;notify('EF1 code generated for '+pack.questions.length+' questions.');
 }catch(e){notify('Cannot export: '+e.message)}
};
$('copyCode').onclick=async()=>{
 if(!S.code)return;
 try{await navigator.clipboard.writeText(S.code);notify('Copied EF1 code.')}
 catch(e){$('exportOutput').select();document.execCommand('copy');notify('Code selected for copying.')}
};
$('downloadCode').onclick=()=>{
 if(!S.code)return;
 const url=URL.createObjectURL(new Blob([S.code],{type:'text/plain'})),a=document.createElement('a');
 a.href=url;a.download='ExamForge_CBT_'+Date.now()+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('beforeunload',()=>clearInterval(S.timer));
updateCount();renderSaved();
