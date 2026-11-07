import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import {money} from './api';
const alerts=Swal.mixin({
  confirmButtonText:'Entendi',confirmButtonColor:'#af8b43',cancelButtonColor:'#777568',
  customClass:{popup:'glam-alert',confirmButton:'glam-alert-confirm',cancelButton:'glam-alert-cancel'},
  heightAuto:false
});
export const showError=message=>alerts.fire({icon:'error',titleText:'Não foi possível concluir',text:message});
export const showSuccess=(message='Salvo com sucesso.')=>alerts.fire({icon:'success',titleText:message,toast:true,position:'top-end',showConfirmButton:false,timer:3000,timerProgressBar:true,didOpen:popup=>{popup.onmouseenter=Swal.stopTimer;popup.onmouseleave=Swal.resumeTimer;}});
export async function confirmAction(title,message,confirmButtonText='Confirmar') {
  const result=await alerts.fire({icon:'warning',titleText:title,text:message,showCancelButton:true,cancelButtonText:'Cancelar',confirmButtonText,reverseButtons:true,focusCancel:true});
  return result.isConfirmed;
}
export async function confirmDeposit(service) {
  const content=document.createElement('div');
  content.className='deposit-alert-content';
  content.innerHTML=`<div class="deposit-wallet" aria-hidden="true"><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3"/><path d="M3 6h15a2 2 0 0 1 2 2v2"/><rect x="16" y="10" width="6" height="6" rx="1"/><path d="M19 13h.01"/></svg></div><p class="deposit-eyebrow">ANTES DE ESCOLHER SEU HORÁRIO</p><h2 id="deposit-alert-heading">Confirme seu horário com o sinal</h2><p class="deposit-introduction">O agendamento de <strong data-service></strong> só será confirmado após a aprovação do pagamento do sinal de <strong>30%</strong>.</p><div class="deposit-amount"><span>Sinal para confirmar</span><strong data-deposit></strong><small>O valor será abatido do total do serviço.</small></div><p class="deposit-explanation">Escolher o dia e o horário ainda não confirma o atendimento. Após criar a reserva, o horário fica temporariamente bloqueado por 10 minutos para o pagamento do sinal.</p>`;
  content.querySelector('[data-service]').textContent=service.name;
  content.querySelector('[data-deposit]').textContent=money(Math.round(Math.round(Number(service.price)*100)*.3)/100);
  const result=await alerts.fire({
    html:content,showCloseButton:true,closeButtonAriaLabel:'Fechar aviso',showCancelButton:true,
    confirmButtonText:'Entendi, escolher profissional →',cancelButtonText:'Voltar',reverseButtons:true,
    buttonsStyling:false,focusConfirm:false,width:520,
    customClass:{popup:'glam-alert deposit-alert',container:'deposit-alert-backdrop',htmlContainer:'deposit-alert-body',actions:'deposit-alert-actions',confirmButton:'gold-button',cancelButton:'outline-button'},
    didOpen:popup=>{popup.setAttribute('aria-labelledby','deposit-alert-heading');}
  });
  return result.isConfirmed;
}
