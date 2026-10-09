import { principles, loopSteps } from './graph-content.js';
import { gateVerdict } from './gate.js';
import { diagramFor, mountRouteLab } from './graph-visuals.js';

const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const menu = document.querySelector('#principle-menu');
const narrowLayout = matchMedia('(max-width: 760px)');
const orientMenu = () => menu.setAttribute('aria-orientation', narrowLayout.matches ? 'horizontal' : 'vertical');
orientMenu();
narrowLayout.addEventListener('change', orientMenu);
const panel = document.querySelector('#principle-detail');
const dialog = document.querySelector('#evidence-dialog');
let selected = 'model';
let evidence = { sources: {} };

function visualFor(item) {
  if(item.id==='gates')return `<div class="gate-lab"><div class="gate-controls"><label><input id="gate-complete" type="checkbox" checked> All required review results are complete</label><label><input id="gate-confirmed" type="checkbox"> A serious bug is confirmed</label></div><div class="gate-verdict" id="gate-verdict" aria-live="polite"><strong>PASS</strong><p>These modeled conditions pass. That is not a guarantee of bug-free code.</p></div></div><span class="diagram-caption">TRY CHANGING A CHECK · SIMPLIFIED FROM THE PROJECT GATE</span>`;
  const note = item.id === 'review' ? 'THREE OF FIVE LENSES SHOWN · BRANCHES JOIN BEFORE VERIFICATION' : item.id === 'hierarchy' ? 'SELECTED PARENT → CHILD LINKS · OUTER GROUP & UPPER ARM OMITTED' : 'SIMPLIFIED RELATIONSHIP DIAGRAM · NOT A LIVE AGENT RUN';
  return `${diagramFor(item)}<span class="diagram-caption">${note}</span>`;
}

menu.innerHTML = principles.map((item,index)=>`<button id="tab-${item.id}" role="tab" aria-selected="${index===0}" aria-controls="principle-detail" tabindex="${index===0?0:-1}" data-principle="${item.id}"><span>${String(index+1).padStart(2,'0')}</span>${escape(item.title)}</button>`).join('');

function selectPrinciple(id, focus=false) {
  const item = principles.find(item=>item.id===id);
  if (!item) return;
  selected=id;
  document.querySelectorAll('[data-principle]').forEach(button=>{const active=button.dataset.principle===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  panel.setAttribute('aria-labelledby',`tab-${id}`);
  panel.innerHTML = `<div class="detail-topline"><span class="eyebrow">${escape(item.category)}</span><span class="badge ${item.status}">${item.status.toUpperCase()}</span></div><h3>${escape(item.title)}</h3><p class="principle-definition">${escape(item.definition)}</p><p class="detail-analogy">${escape(item.analogy)}</p><div class="principle-visual">${visualFor(item)}</div><div class="graph-form"><span class="badge limitation">${escape(item.form)}</span></div><div class="detail-columns"><div><h4>WHY IT MATTERS</h4><p>${escape(item.why)}</p></div><div><h4>HOW WARSAW APPLIED IT</h4><p>${escape(item.application)}</p></div></div><div class="detail-when"><h4>WHEN TO APPLY IT IN GENERAL</h4><p>${escape(item.when)}</p></div><p class="detail-limit"><strong>Evidence limit.</strong> ${escape(item.limit)}</p><div class="detail-sources"><button class="source-link" data-source="${item.source}">Open the supporting evidence ↗</button><span class="badge limitation">SCOPE & LIMITS INCLUDED</span></div>`;
  if(focus){document.querySelector(`#tab-${id}`).focus({preventScroll:true});document.querySelector(`#tab-${id}`).scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
}
selectPrinciple(selected);
panel.addEventListener('change',event=>{
  if(!event.target.id.startsWith('gate-'))return;
  const result=gateVerdict({complete:document.querySelector('#gate-complete').checked,confirmed:document.querySelector('#gate-confirmed').checked});
  const verdict=document.querySelector('#gate-verdict');verdict.className=`gate-verdict ${result.state.toLowerCase()}`;verdict.querySelector('strong').textContent=result.state;verdict.querySelector('p').textContent=result.message;
});

menu.addEventListener('keydown',event=>{
  const index=principles.findIndex(item=>item.id===selected);
  let next=index;
  if(['ArrowDown','ArrowRight'].includes(event.key))next=(index+1)%principles.length;
  else if(['ArrowUp','ArrowLeft'].includes(event.key))next=(index+principles.length-1)%principles.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=principles.length-1;
  else return;
  event.preventDefault();selectPrinciple(principles[next].id,true);
});

function openEvidence(id) {
  const source=evidence.sources[id];
  const out=document.querySelector('#dialog-content');
  if(!source){out.innerHTML='<span class="eyebrow">SOURCE INDEX</span><h2 id="dialog-title">Evidence is loading.</h2><p>The source index is not available yet. All source paths and limitations are retained in the downloadable audit files.</p>';}
  else{
    out.innerHTML=`<span class="eyebrow">SOURCE NOTE / ${escape(source.kind)}</span><h2 id="dialog-title">${escape(source.title)}</h2><p>${escape(source.summary)}</p>${source.entries.map(entry=>`<div class="source-entry"><small>${escape(entry.type.toUpperCase())}${entry.date?' · '+escape(entry.date):''}</small><h3>${escape(entry.title)}</h3><div class="source-path">${escape(entry.path)}${entry.line?':'+escape(entry.line):''}</div>${entry.excerpt?`<blockquote>${escape(entry.excerpt)}</blockquote>`:''}<p>${escape(entry.explanation)}</p></div>`).join('')}<p class="audit-scope"><strong>Limit.</strong> ${escape(source.limit)}</p>`;
  }
  if(!dialog.open)dialog.showModal();
}
document.querySelector('#close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});

const scrollToPrinciple=id=>{selectPrinciple(id);document.querySelector('#principles').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
document.addEventListener('click',event=>{
  const source=event.target.closest('[data-source]');if(source){openEvidence(source.dataset.source);return;}
  const principle=event.target.closest('[data-principle]');if(principle){selectPrinciple(principle.dataset.principle);return;}
  const example=event.target.closest('[data-open-principle]');if(example){selectPrinciple(example.dataset.openPrinciple);return;}
  const concept=event.target.closest('[data-concept]');if(concept)scrollToPrinciple(concept.dataset.concept);
});
mountRouteLab();

let loopStep=0;
function setLoop(index){loopStep=index;const step=loopSteps[index];document.querySelector('#loop-step-label').textContent=step.label;document.querySelector('#loop-title').textContent=step.title;document.querySelector('#loop-description').textContent=step.description;document.querySelector('#loop-art').innerHTML=`<div class="column-art ${step.art}"></div>`;document.querySelectorAll('[data-loop]').forEach(button=>{const active=Number(button.dataset.loop)===index;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});document.querySelector('#loop-next').textContent=index===3?'Start again ↺':'Next step →';}
setLoop(0);
document.querySelector('#loop-next').addEventListener('click',()=>setLoop((loopStep+1)%4));
document.querySelectorAll('[data-loop]').forEach(button=>button.addEventListener('click',()=>setLoop(Number(button.dataset.loop))));

async function loadEvidence(){
  try{
    const response=await fetch('./data/evidence.json');if(!response.ok)throw new Error('Missing source index');evidence=await response.json();
    document.querySelector('#evidence-cards').innerHTML=evidence.featured.map(id=>{const item=evidence.sources[id];return `<article class="evidence-card"><span class="badge ${item.kind==='observed'?'observed':'documented'}">${escape(item.kind.toUpperCase())}</span><h3>${escape(item.title)}</h3><p>${escape(item.card || item.summary)}</p><span class="source-date">${escape(item.date||'AUDIT SNAPSHOT / 5 OCT 2026')}</span><button class="source-link" data-source="${id}">Trace the example ↗</button></article>`;}).join('');
  }catch{document.querySelector('#evidence-cards').innerHTML='<p>The source index could not be loaded. Reload the page or read the local research files.</p>';}
}
await loadEvidence();

const video=document.querySelector('#explainer');
video.addEventListener('play',()=>{const worldPause=document.querySelector('#motion-toggle');if(worldPause.getAttribute('aria-pressed')==='false')worldPause.click();});
try{
  const metaResponse=await fetch('./film/metadata.json');
  if(metaResponse.ok){const meta=await metaResponse.json();if(Array.isArray(meta.chapters))document.querySelector('#film-chapters').innerHTML=meta.chapters.map(chapter=>`<li><button data-time="${Number(chapter.time)||0}" aria-label="Play chapter ${escape(chapter.title)}">${escape(chapter.title)}</button></li>`).join('');}
  const transcript=await fetch('./film/transcript.txt');
  if(transcript.ok)document.querySelector('#film-transcript').innerHTML=(await transcript.text()).split(/\n\s*\n/).filter(Boolean).map(text=>`<p>${escape(text)}</p>`).join('');
}catch{/* The film remains available through native controls and the download link. */}
document.querySelector('#film-chapters').addEventListener('click',event=>{const button=event.target.closest('[data-time]');if(button){video.currentTime=Number(button.dataset.time);video.play().catch(()=>{});}});

try{const {createWorld}=await import('./world.js');createWorld(scrollToPrinciple);}
catch{document.querySelector('#world-fallback').hidden=false;document.querySelector('#world').hidden=true;document.querySelector('.world-toolbar').hidden=true;}
