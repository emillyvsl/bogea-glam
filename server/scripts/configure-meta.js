// Receive credentials as one JSON line on stdin; never echo them.
import {createInterface} from 'node:readline';
import {readFile,writeFile} from 'node:fs/promises';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Pronto para receber configuração JSON pelo stdin (entrada oculta).');
const input=createInterface({input:process.stdin,terminal:false});
input.once('line',async line=>{
  input.close();process.stdin.pause();
  try{
    const config=JSON.parse(line);
    if(typeof config.token!=='string'||!config.token.trim()||/[\r\n]/.test(config.token))throw new Error('Token inválido.');
    const file=new URL('../.env',import.meta.url);
    let text=await readFile(file,'utf8');
    const values={WHATSAPP_PROVIDER:'meta',META_WHATSAPP_ENABLED:'true',META_WHATSAPP_TOKEN:config.token.trim(),META_WHATSAPP_PHONE_NUMBER_ID:'1433074169889943',META_WHATSAPP_API_VERSION:'v25.0',META_WHATSAPP_TEST_TEMPLATE:'jaspers_market_order_confirmation_v1',META_WHATSAPP_TEST_LANGUAGE:'en_US'};
    for(const[key,value]of Object.entries(values)){
      const pattern=new RegExp(`^${key}=.*$`,'m');
      if(pattern.test(text))text=text.replace(pattern,()=>`${key}=${value}`);else text+=`\n${key}=${value}`;
    }
    await writeFile(file,`${text.trimEnd()}\n`);
    console.log('Configuração da Meta salva no servidor; credencial não exibida.');
  }catch{console.error('Não foi possível salvar a configuração da Meta.');process.exitCode=1;}
});
