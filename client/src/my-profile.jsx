import React,{useState} from 'react';
import {send} from './api';
import {showError,showSuccess} from './alerts';
import GoogleCalendarSettings from './google-calendar-settings';

export default function MyProfile({user,onUpdate}){
  const [form,setForm]=useState({name:user.name,email:user.email,currentPassword:'',newPassword:'',confirmation:''}),[busy,setBusy]=useState(false);
  const field=key=>({value:form[key],onChange:e=>setForm({...form,[key]:e.target.value})});
  const sensitive=form.email.trim().toLowerCase()!==user.email||!!form.newPassword;
  async function save(event){
    event.preventDefault();if(form.newPassword!==form.confirmation){showError('A confirmação da nova senha não confere.');return;}
    setBusy(true);try{const result=await send('/auth/profile',{name:form.name,email:form.email,currentPassword:form.currentPassword,newPassword:form.newPassword},'PATCH');onUpdate(result.user);setForm({name:result.user.name,email:result.user.email,currentPassword:'',newPassword:'',confirmation:''});showSuccess('Perfil atualizado com sucesso.');}catch(error){showError(error.message);}finally{setBusy(false);}
  }
  return <div className="my-profile"><form className="editor" onSubmit={save}><h2>Meus dados</h2><p>Atualize seus dados de acesso e de identificação no salão.</p><div className="form-grid"><label>Nome completo<input required autoComplete="name" minLength={2} maxLength={120} {...field('name')}/></label><label>E-mail<input required type="email" autoComplete="username" maxLength={254} {...field('email')}/></label></div><h3>Alterar senha</h3><p>Preencha a nova senha apenas se quiser alterá-la.</p><div className="form-grid"><label>Nova senha<input type="password" autoComplete="new-password" minLength={12} maxLength={256} {...field('newPassword')}/></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" required={!!form.newPassword} maxLength={256} {...field('confirmation')}/></label></div>{sensitive&&<><label>Senha atual<input type="password" required autoComplete="current-password" maxLength={256} {...field('currentPassword')}/></label><p>Ao alterar e-mail ou senha, as outras sessões serão encerradas.</p></>}<button className="primary-button" disabled={busy}>{busy?'Salvando…':'Salvar meu perfil'}</button></form><GoogleCalendarSettings user={user}/></div>;
}
