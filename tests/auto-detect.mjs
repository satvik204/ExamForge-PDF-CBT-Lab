'use strict';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const files=['index.html','styles.css','app.js','auto-detect.js','README.md'];
for(const path of files)assert.ok(existsSync(path),'Missing '+path);
const html=readFileSync('index.html','utf8'),app=readFileSync('app.js','utf8'),scan=readFileSync('auto-detect.js','utf8');
for(const file of ['app.js','auto-detect.js']){
 const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 assert.equal(checked.status,0,file+' syntax error '+checked.stderr);
}
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
const used=new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]));
assert.deepEqual([...used].filter(id=>!ids.has(id)),[],'References to nonexistent HTML elements');
for(const id of ['autoDetectBtn','autoCancelBtn','autoSubjectOrder','autoProgressBar','autoProgressLabel','autoScanReport','autoScanPill'])assert.ok(ids.has(id));
assert.ok(html.includes('src="auto-detect.js"'));
assert.ok(html.indexOf('src="auto-detect.js"')<html.indexOf('src="app.js"'));
const ctx={window:{}};
vm.runInNewContext(scan,ctx,{timeout:1000});
const e=ctx.window.ExamForgeAutoDetect;
assert.equal(e.classify('Question Number : 1').number,1);
assert.equal(e.classify('Q. 2 Example').number,2);
assert.equal(e.classify('3. Find the correct result').number,3);
assert.equal(e.classify('Option 1. False'),null);
const sample=(n,y,x=32)=>({text:'Question Number : '+n,x,y,right:x+200,pageWidth:700,pageHeight:900});
const lines=[sample(1,100),sample(2,430),sample(3,720)];
const detection=e.detectPage(lines,1);
assert.equal(detection.anchors.length,3);
const planned=e.planPages([detection]);
assert.equal(planned.candidates.length,3);
assert.ok(planned.candidates[0].rect.h>.1);
assert.equal(planned.candidates[2].flags.length>0,true);
const twoColumns=e.detectPage([
 sample(1,90,30),sample(2,340,30),sample(3,630,30),
 sample(4,90,400),sample(5,340,400),sample(6,630,400)
],1);
const twoPlan=e.planPages([twoColumns]);
assert.equal(twoPlan.candidates.length,6);
assert.deepEqual(Array.from(twoPlan.candidates.map(x=>x.printedNumber)),[1,2,3,4,5,6]);
assert.ok(twoPlan.candidates.every(x=>x.rect.w<.5),'Two-column crops must stay inside their column');
const all=[];
for(let p=1;p<=15;p++){
 const rows=[];
 for(let q=1;q<=5;q++)rows.push(sample((p-1)*5+q,80+q*140));
 all.push(e.detectPage(rows,p));
}
const complete=e.planPages(all);
assert.equal(complete.candidates.length,75);
assert.ok(!complete.warnings.some(x=>x.includes('not 75')));
console.log('PASS: JavaScript syntax, UI IDs, script order, Q-number matching, 75-question plan');
