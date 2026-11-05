import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as inquiryModel from '../public/consulta/model.js';
import {services,questions,conditionalQuestions,buildInquiry,summary,whatsappMessage} from '../public/consulta/model.js';
const id='11111111-1111-4111-8111-111111111111',date='2026-10-03T12:00:00-03:00';
test('software enquiries retain the versioned minimal schema and reject retired services',()=>{
  assert.deepEqual(Object.keys(services),['SOFTWARE']);
  assert.deepEqual(Object.keys(questions),['SOFTWARE']);
  const inquiry=buildInquiry('SOFTWARE',{name:'Cliente'},{need:'Sitio web'},id,date);
  assert.equal(inquiry.version,1);assert.equal(inquiry.schema,'scalaris.inquiry');
  assert.match(summary(inquiry),/Cliente/);assert.equal(inquiry.contact.phone,'');
  for(const service of ['EQUIPMENT','PARTS','toString'])assert.throws(()=>buildInquiry(service,{name:'Cliente'},{problem:'Falla',part:'Memoria'},id,date),/Elegí un servicio/);
});
test('branch switch drops unrelated answers and credentials',()=>{const inquiry=buildInquiry('SOFTWARE',{name:'A',password:'never'},{need:'Sistema',password:'never',problem:'old'},id,date);assert.equal(inquiry.answers.problem,undefined);assert.equal(inquiry.answers.password,undefined);assert.equal(inquiry.contact.password,undefined);});
test('WhatsApp URL is brief and omits entered identity and phone',()=>{const inquiry=buildInquiry('SOFTWARE',{name:'PRIVATE-NAME',phone:'PRIVATE-PHONE'},{need:'x'.repeat(1800)},id,date);const message=whatsappMessage(inquiry);assert.ok(message.length<400);assert.ok(!message.includes('PRIVATE'));});
test('validation requires useful identity and software detail',()=>{assert.throws(()=>buildInquiry('SOFTWARE',{name:'A'},{},id,date));assert.throws(()=>buildInquiry('SOFTWARE',{name:'A'},{need:'x'.repeat(2001)},id,date));assert.throws(()=>buildInquiry('SOFTWARE',{name:''},{need:'Sitio web'},id,date));});

test('custom development and integrations remain available without hardware answers',()=>{
  assert.ok(questions.SOFTWARE[0].options.includes('Software a medida'));
  assert.ok(questions.SOFTWARE[0].options.includes('Automatización / integración'));
  const answers={topic:'Automatización / integración',need:'Conectar pedidos',compatibility:'ERP y catálogo',model:'hardware antiguo',part:'repuesto'};
  assert.deepEqual(conditionalQuestions('SOFTWARE',answers).map(q=>q.key),['compatibility']);
  const inquiry=buildInquiry('SOFTWARE',{name:'Cliente'},answers,id,date);
  assert.equal(inquiry.answers.compatibility,'ERP y catálogo');
  assert.equal(inquiry.answers.model,undefined);assert.equal(inquiry.answers.part,undefined);
});
test('form has no personal persistence, network fetch or analytics',()=>{const code=readFileSync(new URL('../public/consulta/form.js',import.meta.url),'utf8');assert.ok(!/localStorage|sessionStorage|fetch\(|sendBeacon|XMLHttpRequest/.test(code));assert.ok(code.includes('wa.me/5491172789289'));});

test('the first submit reads autofilled values and a topic change preserves the review button',()=>{
  // A small event-capable DOM is enough to reproduce change-on-blur followed by
  // submission, including values written by autofill without an input event.
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.listeners={};this.value='';this.ownText='';this.classList={add(){},toggle(){}};}
    setAttribute(key,value){this.attributes[key]=value;if(['type','href','name'].includes(key))this[key]=value;}
    removeAttribute(key){delete this.attributes[key];}
    append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
    replaceChildren(...nodes){for(const child of this.children)child.parent=null;this.children=[];this.append(...nodes);}
    set textContent(value){this.ownText=value;this.children=[];}
    get textContent(){return this.ownText+this.children.map(child=>child.textContent).join(' ');}
    addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
    dispatch(type){for(const handler of this.listeners[type]??[])handler({preventDefault(){}});}
    find(predicate){for(const child of this.children){if(predicate(child))return child;const nested=child.find(predicate);if(nested)return nested;}return null;}
    querySelector(selector){return this.find(child=>child.tagName===selector);}
    get elements(){return{namedItem:name=>this.find(child=>child.name===name)};}
    focus(){}
    scrollIntoView(){}
  }
  const root=new Element('main'),error=new Element('p');
  const code=readFileSync(new URL('../public/consulta/form.js',import.meta.url),'utf8')
    .replace(/^import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";\s*/gm,'');
  const context=vm.createContext({...inquiryModel,crypto:{randomUUID:()=>id},
    document:{createElement:tag=>new Element(tag),querySelector:selector=>selector==='#form-root'?root:error,querySelectorAll:()=>[]},
    window:{location:{search:''}},hasPlanSelection:()=>false,
  });
  vm.runInContext(code,context);
  const form=root.find(child=>child.tagName==='form');
  const review=form.find(child=>child.type==='submit');
  form.elements.namedItem('name').value='Nombre autocompletado';
  form.elements.namedItem('need').value='Conectar los pedidos de mi negocio';
  const topic=form.elements.namedItem('topic');
  topic.value='Automatización / integración';
  topic.dispatch('change');
  assert.equal(root.find(child=>child.tagName==='form'),form,'Changing topic must retain the form under the pending click.');
  assert.equal(form.find(child=>child.type==='submit'),review,'The first review button remains attached.');
  form.elements.namedItem('compatibility').value='Sistema de pedidos actual';
  form.dispatch('submit');
  assert.match(root.textContent,/Tu consulta, lista para compartir/);
  assert.match(root.textContent,/Nombre autocompletado/);
  assert.match(root.textContent,/Conectar los pedidos de mi negocio/);
  assert.match(root.textContent,/Sistema de pedidos actual/);
});
