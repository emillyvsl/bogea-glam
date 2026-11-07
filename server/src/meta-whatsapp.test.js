import test from 'node:test';
import assert from 'node:assert/strict';
import {internationalPhone,sendMetaTemplate,appointmentComponents,metaTestMessage} from './meta-whatsapp.js';
import {confirmationTemplate,confirmationPreview} from './confirmation-template.js';
test('Meta: telefone brasileiro, payload, token só no cabeçalho e erros',async()=>{
  const keys=['META_WHATSAPP_ENABLED','META_WHATSAPP_TOKEN','META_WHATSAPP_PHONE_NUMBER_ID','META_WHATSAPP_API_VERSION'];
  const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{META_WHATSAPP_ENABLED:'true',META_WHATSAPP_TOKEN:'test-only-token',META_WHATSAPP_PHONE_NUMBER_ID:'12345',META_WHATSAPP_API_VERSION:'v25.0'});
  try{
    assert.equal(internationalPhone('68999999999'),'5568999999999');
    assert.equal(internationalPhone('+55 (68) 99999-9999'),'5568999999999');
    assert.throws(()=>internationalPhone('123'));
    let request;
    const result=await sendMetaTemplate({to:'68999999999',name:'hello_world',language:'en_US'},async(url,options)=>{request={url,options};return new Response(JSON.stringify({messages:[{id:'wamid.test'}]}));});
    assert.equal(result.status,'Aceita pela Meta');assert.equal(request.url,'https://graph.facebook.com/v25.0/12345/messages');
    assert.equal(request.options.headers.Authorization,'Bearer test-only-token');assert.equal(request.options.body.includes('test-only-token'),false);
    assert.deepEqual(JSON.parse(request.options.body),{messaging_product:'whatsapp',to:'5568999999999',type:'template',template:{name:'hello_world',language:{code:'en_US'}}});
    await assert.rejects(()=>sendMetaTemplate({to:'68999999999',name:'hello_world'},async()=>new Response(JSON.stringify({error:{code:190,message:'expired'}}),{status:401})),error=>error.uncertain===false&&/expirado/.test(error.message));
    await assert.rejects(()=>sendMetaTemplate({to:'68999999999',name:'hello_world'},async()=>{throw new Error('timeout')}),error=>error.uncertain===true);
    await assert.rejects(()=>sendMetaTemplate({to:'68999999999',name:'hello_world'},async()=>new Response(JSON.stringify({messages:[]}))),error=>error.uncertain===true);
  }finally{for(const key of keys)if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}
});
test('Meta: parâmetros de confirmação de atendimento',()=>{
  const original=process.env.META_WHATSAPP_CONFIRMATION_FIELDS;delete process.env.META_WHATSAPP_CONFIRMATION_FIELDS;
  try{assert.deepEqual(appointmentComponents({clientName:'Cliente',bookingDate:new Date('2026-11-04T00:00:00Z'),startMinute:540},'confirmation-client'),[{type:'body',parameters:[{type:'text',text:'Cliente'},{type:'text',text:'04/11/2026'},{type:'text',text:'09:00'}]}]);}
  finally{if(original===undefined)delete process.env.META_WHATSAPP_CONFIRMATION_FIELDS;else process.env.META_WHATSAPP_CONFIRMATION_FIELDS=original;}
});
test('Meta: modelo de teste Jasper recebe os três parâmetros obrigatórios',()=>{
  const original=process.env.META_WHATSAPP_TEST_TEMPLATE;
  try{
    process.env.META_WHATSAPP_TEST_TEMPLATE='jaspers_market_order_confirmation_v1';
    const payload=metaTestMessage('68999999999');
    assert.equal(payload.components[0].parameters.length,3);
    assert.equal(payload.components[0].parameters[1].text,'TESTE-SEM-PEDIDO');
    process.env.META_WHATSAPP_TEST_TEMPLATE='hello_world';
    assert.equal(metaTestMessage('68999999999').components,undefined);
  }finally{if(original===undefined)delete process.env.META_WHATSAPP_TEST_TEMPLATE;else process.env.META_WHATSAPP_TEST_TEMPLATE=original;}
});
test('Confirmação final em português: dados reais e sinal sem falsa quitação',()=>{
  const original=process.env.META_WHATSAPP_CONFIRMATION_FIELDS;
  process.env.META_WHATSAPP_CONFIRMATION_FIELDS='clientName,services,professionalName,date,timeRange,depositStatus,remaining';
  const booking={id:1,clientName:'Maria',serviceNames:['Escova'],professional:{name:'Emilly'},bookingDate:new Date('2026-11-10T00:00:00Z'),startMinute:540,endMinute:600,deposit:36,totalPrice:120,paid:true};
  try{
    const values=appointmentComponents(booking,'confirmation-client')[0].parameters.map(p=>p.text);
    const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
    assert.deepEqual(values,['Maria','Escova','Emilly','10/11/2026','09:00 às 10:00',`${money(36)} recebido`,money(84)]);
    const unpaid=appointmentComponents({...booking,paid:false},'confirmation-client')[0].parameters.map(p=>p.text);
    assert.match(unpaid[5],/não registrado/);assert.equal(unpaid[6],money(120));
    const body=confirmationTemplate.components.find(c=>c.type==='BODY');assert.equal(body.example.body_text[0].length,values.length);
    assert.equal(confirmationPreview().text.includes('{{'),false);assert.match(confirmationPreview().text,/Maria/);
  }finally{if(original===undefined)delete process.env.META_WHATSAPP_CONFIRMATION_FIELDS;else process.env.META_WHATSAPP_CONFIRMATION_FIELDS=original;}
});
