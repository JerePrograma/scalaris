import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
