# Confirmação de agendamento

O arquivo `appointment-confirmation.json` contém o modelo proposto para cadastrar no Gerenciador do WhatsApp da Meta: nome `bogea_agendamento_confirmado`, idioma Português (Brasil), categoria Utilidade. Copie o cabeçalho, corpo, rodapé e exemplos desse arquivo para o cadastro do modelo. A prévia com dados de exemplo aparece na seção WhatsApp do gerenciador do salão.

Após a aprovação pela Meta, copie as três configurações de `confirmation.env.example` para `server/.env` e reinicie o backend. Não substitua o token nem as demais configurações. Até essa alteração, permanece ativo o modelo de demonstração já configurado.

Os sete parâmetros são preenchidos, nesta ordem, com nome do cliente, serviços, profissional, data, horário de início e fim, situação do sinal e restante a pagar. O sistema só escreve “recebido” quando o sinal está registrado como pago; a confirmação do agendamento não significa quitação do valor total.

Alterar este JSON modifica a prévia local, mas não atualiza um modelo já cadastrado na Meta. O texto enviado corresponde ao modelo aprovado selecionado nas variáveis de ambiente.
