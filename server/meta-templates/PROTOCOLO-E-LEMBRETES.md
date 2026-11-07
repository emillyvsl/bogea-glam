# Confirmação, protocolo e lembretes

Os modelos propostos para cadastrar na Meta estão em `appointment-messages.json`. A confirmação usa cinco parâmetros: nome, serviços, data, horário e protocolo. Os lembretes usam nome e horário. Aprovar o texto sem protocolo não autoriza acrescentar uma quinta variável no envio; o modelo precisa conter esse campo.

Depois da aprovação, copie as variáveis de `appointment-messages.env.example` para `server/.env`, ajustando os nomes para os aprovados e mantendo o token válido. Reinicie o backend. O modelo de demonstração existente permanece ativo até essa troca; não envia os novos textos em português automaticamente.

O protocolo é gerado mesmo quando o cliente não autoriza WhatsApp. A consulta fica no site principal, em “Consultar”, e expõe somente situação, serviços, data, horário e profissional. Não expõe nome, telefone ou valores. O código aleatório deve ser guardado pelo cliente.

Lembretes são agendados 24h e 2h antes, no fuso de Rio Branco, somente se esses horários ainda forem futuros. O envio periódico exige `REMINDERS_ENABLED=true`, consentimento e atendimento ainda confirmado. Um atendimento criado com menos de 24h de antecedência não recebe o aviso de 24h. Cada mensagem tem uma chave única por reserva e tipo. Falhas e respostas inconclusivas ficam no painel WhatsApp para conferência; não são repetidas automaticamente.

A configuração não envia mensagens antigas de teste novamente nem efetua cobranças. Reservas confirmadas anteriores recebem protocolo na migração; os lembretes futuros dessas reservas são preparados pelo executor após a ativação, sem repetir confirmações antigas.

