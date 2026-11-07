import React,{ useState } from 'react';
import { api,send } from './api';
import {showError} from './alerts';
export default function Account({ onLogin, allowRegister = false }) {
  const [register,setRegister] = useState(false), [form,setForm] = useState({ name:'',email:'',password:'' }), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const field = name => ({ value:form[name],onChange:e=>setForm({ ...form,[name]:e.target.value }) });
  return <form className="account-form" onSubmit={async e=>{
    e.preventDefault(); setBusy(true); setError('');
    try {
      if(register) await send('/auth/register',form);
      const { user } = await send('/auth/login',form); onLogin(user);
    } catch(err) { setError(err.message);showError(err.message); } finally { setBusy(false); }
  }}><h2>{register?'Crie sua conta':'Entre na sua conta'}</h2>{register&&<label>Nome<input required autoComplete="name" {...field('name')}/></label>}<label>E-mail<input type="email" autoComplete="username" required {...field('email')}/></label><label>Senha<input type="password" required minLength={register?12:undefined} maxLength={256} autoComplete={register?'new-password':'current-password'} {...field('password')}/></label>{register&&<small>Use pelo menos 12 caracteres.</small>}{error&&<p className="notice" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'Aguarde…':register?'Criar conta e entrar':'Entrar'}</button>{allowRegister&&<button className="back-button" type="button" onClick={()=>{setRegister(!register);setError('');}}>{register?'Já tenho conta':'Ainda não tenho conta'}</button>}</form>;
}
