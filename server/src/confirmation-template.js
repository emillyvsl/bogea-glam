import {readFileSync} from 'node:fs';
export const confirmationTemplate=JSON.parse(readFileSync(new URL('../meta-templates/appointment-confirmation.json',import.meta.url),'utf8'));
export function confirmationPreview(){
  const body=confirmationTemplate.components.find(c=>c.type==='BODY');
  const example=body.example.body_text[0];
  return {name:confirmationTemplate.name,language:confirmationTemplate.language,text:body.text.replace(/\{\{(\d+)\}\}/g,(_,index)=>example[Number(index)-1])};
}
