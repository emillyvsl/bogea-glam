# Bogéa Glam

Agendamento com React 19, Node.js/Express, PostgreSQL e Prisma 6.12.

## Primeira execução

Requisitos: Node.js 20.9+ e PostgreSQL 15+ (ou Docker Desktop).

```powershell
docker compose up -d
npm install
npm install --prefix server
npm install --prefix client
Copy-Item server/.env.example server/.env
```

Se server/.env já existir, edite-o em vez de sobrescrever. Configure:

```env
DATABASE_URL=postgres://bogea:bogea_dev@localhost:5432/bogea_glam
APP_ORIGIN=http://localhost:5173
ADMIN_EMAIL=admin@bogeaglam.local
ADMIN_PASSWORD=defina_uma_senha_forte_de_12_ou_mais_caracteres
```

ADMIN_API_KEY foi removida e pode ser apagada do seu .env. Nunca coloque senhas em variáveis VITE_.

Na raiz do projeto:

```powershell
npm run db:setup
npm run db:seed
npm run dev
```

- Catálogo: http://localhost:5173
- Administração: http://localhost:5173/?painel=agenda

Entre com o e-mail e a senha configurados antes do seed. O seed cria o primeiro administrador, quatro serviços e dois profissionais. Pode ser repetido: não apaga agendamentos, não duplica os dados iniciais e não altera senhas de usuários existentes. Alterar ADMIN_PASSWORD depois do primeiro seed não altera a senha já salva.

## Migrações e banco existente

O Prisma controla o esquema em server/prisma/schema.prisma e o histórico em server/prisma/migrations. O servidor não cria nem popula tabelas ao iniciar.

`npm run db:setup` aplica as migrações e gera o cliente. Para bancos da versão anterior, verifica as colunas conhecidas e registra a migração inicial como já aplicada, preservando os registros, antes de criar usuários e sessões. Faça backup de bancos com dados importantes antes de migrar. Nenhum reset é necessário.

Depois de editar schema.prisma, gere uma nova migração em desenvolvimento:

```powershell
npm run db:migrate -- --name nome_da_alteracao
```

Para aplicar migrações já versionadas em outro ambiente:

```powershell
npm run db:deploy
npm --prefix server run db:generate
```

Interface visual para consultar/editar o banco local:

```powershell
npm run db:studio
```

O Prisma gerencia serviços, profissionais, agendamentos, configuração, bloqueios, usuários, sessões, pagamentos e notificações. Alterações da agenda e de configuração usam um bloqueio transacional PostgreSQL compartilhado, inclusive quando a agenda está vazia.

## Login

Senha armazenada com scrypt e salt aleatório. Sessão de oito horas em cookie HttpOnly/SameSite=Lax, token armazenado como hash no banco, consulta de sessão ao recarregar e botão Sair com invalidação no servidor. As rotas administrativas exigem usuário ativo com perfil ADMIN. Há limite de tentativas por IP no processo e validação da origem de requisições de escrita. Em produção use HTTPS, NODE_ENV=production e APP_ORIGIN com a origem real. O limite de tentativas deve usar armazenamento compartilhado ao executar várias instâncias.

## Gerenciador e perfis

O administrador tem as abas Agenda, Novo agendamento, Serviços, Equipe, Funcionamento, Bloqueios, Pagamentos e WhatsApp.

- Funcionamento: nome, endereço, WhatsApp, abertura/fechamento/almoço de cada dia e antecedência dos lembretes.
- Serviços: nome, categoria, descrição, imagem, duração de 15 a 600 minutos, preço e situação ativa. Imagens podem ser `/images/arquivo.jpg` ou URL HTTPS. As fotos colocadas em client/public/images já foram associadas aos quatro serviços iniciais.
- Equipe: nome, e-mail e senha individual, serviços realizados, opção de realizar todos, expediente próprio ou do salão e situação ativa. Edite os profissionais iniciais para definir a primeira senha. Desativar bloqueia novas reservas e sessões. Mudar senha invalida sessões anteriores.
- Bloqueios: dia, período, motivo e agenda individual ou todo o salão. Para um feriado completo use 00:00 até 23:59.
- Agendamento manual: múltiplos serviços, profissional compatível e disponibilidade real. Pode confirmar sem checkout e registrar sinal recebido por outro meio.
- Funcionários entram pelo mesmo endereço ou /equipe. Recebem apenas a própria agenda, sem valores financeiros nem histórico dos demais. Podem iniciar, concluir e registrar ausência.
- Clientes criam uma conta no fluxo do catálogo e acessam apenas suas reservas. A autenticação local por e-mail e senha substitui a conta ChatGPT mencionada no documento original, conforme a escolha feita neste projeto.

Alterar o expediente preserva atendimentos anteriores. Confira a agenda ao alterar a configuração; não há relatório automático de conflitos.

## Regras de agendamento

Múltiplos serviços no mesmo profissional. A agenda usa a interseção do expediente do profissional e do salão e a união das pausas. O trabalho pode continuar depois do almoço, mas não no dia seguinte nem após o fechamento. Inícios de hora em hora; término sem arredondamento. Datas/horários passados são rejeitados no fuso America/Rio_Branco. Os serviços e a disponibilidade são conferidos novamente dentro da transação que cria a reserva.

Consultar ou selecionar um horário não o ocupa. Ao reservar, ele fica aguardando pagamento por dez minutos, com contador visual. Reservas vencidas deixam de ocupar a agenda automaticamente na consulta. Consentimento para mensagens é opcional. Sinal de 30% e restante são calculados em centavos. Cliente e funcionário não podem confirmar pagamentos ou alterar parâmetros administrativos.

## InfinitePay

Configure no server/.env (campos no .env.example):

```env
INFINITEPAY_HANDLE=sua_tag_sem_cifrao
INFINITEPAY_API_KEY=sua_chave_de_checkout_integrado
INFINITEPAY_WEBHOOK_PUBLIC=false
```

O servidor cria um checkout de pagamento único com vencimento igual ao da reserva. A chave é necessária para essas opções. O checkout aceita Pix e cartão. O cliente volta para /pagamento-concluido; o servidor consulta /payment_check antes de registrar pagamento ou confirmar. Confere valor, transação única, prazo, status, profissional, serviços e trechos atuais. Pagamento tardio ou divergente fica Em análise no painel. Reembolso é manual, sem estorno automático. Reserva confirmada perde o vencimento temporário; paid indica somente sinal recebido.

Para ativar também a confirmação por webhook, configure INFINITEPAY_WEBHOOK_PUBLIC=true e PUBLIC_API_URL com a origem HTTPS pública da API. A rota é POST /api/webhooks/infinitepay. O aviso externo sozinho não confirma nada: o servidor consulta o provedor. Sem webhook ativo, a confirmação depende do retorno ao site.

Referência oficial utilizada: https://www.infinitepay.io/checkout-documentacao

## WhatsApp

Links manuais estão disponíveis na agenda. Eles abrem uma conversa com texto preenchido e não comprovam envio.

Para envio real, configure TWILIO_ENABLED=true, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (whatsapp:+...), TWILIO_CONFIRMATION_SID e TWILIO_REMINDER_SID. Os modelos devem aceitar as variáveis 1=nome, 2=data e 3=horário; use modelos aprovados no provedor e destinatários autorizados em testes. Configure o WhatsApp do salão na aba Funcionamento.

Quando ativada, uma confirmação futura com consentimento gera notificações separadas para cliente e salão e um lembrete para o cliente (2, 24 ou 48 horas). O lembrete não é criado se o momento já passou. Falha do provedor não desfaz atendimento/pagamento.

REMINDERS_ENABLED=true ativa o processador a cada minuto enquanto o servidor Node estiver rodando. Também há o botão Processar fila agora no painel. Cada execução processa até três itens; uma mensagem com resultado incerto vira Inconclusiva e não é reenviada automaticamente. O status Aceita pelo Twilio não comprova entrega ou leitura; acompanhamento de entrega por callback não foi implementado. Sem credenciais a integração fica desativada e não envia mensagens.

Referência oficial utilizada: https://www.twilio.com/docs/whatsapp/api

## Verificação

```powershell
npm test
npm run build
npm --prefix server run test:db
```

O teste de integração cria e remove somente um banco temporário isolado. Requer permissão PostgreSQL para criar bancos. Cobre migrações novas/legadas, seed repetido, esquema sem divergência, login real com PostgreSQL, contas de cliente/equipe, permissões, dados financeiros ocultos, consentimento opcional, bloqueios, duas reservas concorrentes, agendamento manual, transições e verificação de pagamentos com provedor simulado. Não realiza cobrança ou envio externo. Credenciais reais, URLs públicas e testes com provedores reais ainda são necessários para operação externa.

Cancelamento/reagendamento pelo próprio cliente, cobrança automática do saldo, estorno, recuperação de senha, auditoria completa e chatbot não fazem parte desse fluxo implementado.
## Listagens e upload de imagens

Serviços, Equipe e Bloqueios abrem em listagens com busca e ações por registro. Novo/Editar abre uma tela dedicada com dados preenchidos, Cancelar e Salvar. Serviços e profissionais possuem ações Ativar/Desativar que preservam o histórico dos atendimentos. Bloqueios podem ser editados ou removidos.

Em Serviços, o campo de imagem mostra a foto atual e permite selecionar JPG, PNG ou WebP de até 5 MB, com prévia local. O upload ocorre ao salvar. O endpoint POST /api/admin/images exige sessão de administrador, verifica o tipo/cabeçalho e gera um nome aleatório. Os arquivos ficam em server/uploads/images e são publicados por /api/images. Não é necessário alterar o banco nem copiar arquivos para o frontend.

Inclua server/uploads no backup e preserve essa pasta ao publicar o servidor (volume persistente em contêiner). As imagens antigas são mantidas para não quebrar outros registros; a troca atualiza o caminho do serviço. Cancelar antes de salvar não envia o arquivo. Se o upload ocorrer e o salvamento posterior falhar, o arquivo enviado pode permanecer sem referência.

## Bloqueio de agenda por período

Em Bloqueios de agenda, escolha Uma única data ou Período de datas. O período inclui a data inicial e a final. Pode bloquear o dia inteiro ou um horário que se repete em cada dia do período, para um profissional ou todo o salão. O resumo do formulário mostra exatamente o intervalo antes de salvar. Não cancela atendimentos existentes. Bloqueios antigos foram migrados para períodos com início e fim na mesma data.


## Pagamento com contador na página principal

Ao confirmar os dados, o botão Reservar e pagar sinal cria a reserva e abre o checkout da InfinitePay em outra aba, mantendo a página do agendamento com contador regressivo. O prazo vem do servidor e não reinicia ao recarregar. O navegador guarda apenas o ID da reserva; ao restaurar, o servidor confere a identidade antes de devolver os dados. A página consulta a situação a cada cinco segundos e ao recuperar o foco. O retorno do checkout sinaliza às outras abas para atualizar a reserva.

Enquanto a reserva aguarda pagamento e não expirou, seus intervalos ficam bloqueados na mesma agenda. Ao vencer, deixam de bloquear sem depender do contador do navegador. Pagamento aprovado remove o vencimento. Pagamento tardio ou divergente fica em análise. Com webhook desativado, a confirmação exige o retorno do checkout com os identificadores; consultar a situação local não substitui a consulta ao provedor.

Uma criação de checkout é reservada transacionalmente antes de chamar a InfinitePay. Solicitações simultâneas não criam dois links. O link existente é reutilizado. Resposta desconhecida fica Inconclusiva e bloqueia nova criação automática. Não há uma cobrança real nos testes.

Configure INFINITEPAY_API_KEY no server/.env e reinicie o backend. APP_ORIGIN deve corresponder ao frontend em uso (localhost durante desenvolvimento); o endereço do antigo site hospedado não é o retorno desta aplicação local. INFINITEPAY_WEBHOOK_PUBLIC tem prioridade sobre o nome antigo INFINITEPAY_WEBHOOK_ENABLED quando ambos estiverem definidos.

## Recuperar o link do pagamento

Durante os 10 minutos, o cliente pode clicar em Tentar abrir pagamento novamente. Se o link já existir, ele é reaberto sem uma nova chamada de criação. Se a resposta anterior foi inconclusiva, a tentativa manual reenvia o mesmo pedido e payload salvo, incluindo order_nsu, valor e vencimento. Não é criado outro registro de cobrança nem ampliado o prazo. Solicitações simultâneas continuam bloqueadas. A recuperação é explícita: não há repetição automática em segundo plano. Reservas vencidas ou cobranças aprovadas/em análise não permitem recuperar um novo link. Em tentativas antigas sem payload salvo, o pedido é reconstruído com o mesmo identificador e vencimento da reserva.

## WhatsApp direto pela Meta

WHATSAPP_PROVIDER=meta seleciona a Cloud API da Meta. Configure META_WHATSAPP_ENABLED=true, META_WHATSAPP_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID e META_WHATSAPP_API_VERSION=v25.0 somente no server/.env. Nunca use VITE_ para tokens. Após mudar o token, reinicie o backend.

O painel WhatsApp possui Enviar mensagem de teste, protegido por login administrativo. O destino aceita DDD+número brasileiro e adiciona 55. META_WHATSAPP_TEST_TEMPLATE e META_WHATSAPP_TEST_LANGUAGE escolhem o modelo de teste. Um número de teste da Meta exige que o destinatário esteja cadastrado e confirmado no painel da Meta. O sistema informa a aceitação pela API; entrega/leitura dependem de callbacks que ainda não foram implementados.

Para a fila de agendamentos, configure modelos aprovados em META_WHATSAPP_CONFIRMATION_TEMPLATE e META_WHATSAPP_REMINDER_TEMPLATE, com idioma em META_WHATSAPP_LANGUAGE (padrão pt_BR). As variáveis do corpo são clientName,date,time, nessa ordem. Ajuste META_WHATSAPP_CONFIRMATION_FIELDS e META_WHATSAPP_REMINDER_FIELDS se o modelo tiver outra ordem ou deixe vazio para modelos sem parâmetros. Modelos com imagem, botões ou outros componentes exigem adaptação específica. O modelo de demonstração jaspers_market_order_confirmation_v1 fica reservado ao teste e não é automaticamente usado nos agendamentos.

A fila usa a mesma proteção de consentimento, prazo e processamento das notificações. REMINDERS_ENABLED continua controlando o executor periódico. Token inválido/expirado retorna um erro claro (Meta 190) e não marca mensagem como enviada. Erro de conexão sem resposta fica inconclusivo e não é repetido automaticamente. A alternativa Twilio permanece disponível com WHATSAPP_PROVIDER=twilio.

Referência de templates: https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/

O modelo de teste jaspers_market_order_confirmation_v1 recebe automaticamente três parâmetros de corpo: identificação de teste, referência TESTE-SEM-PEDIDO e data local. Isso corrige o erro Meta 132000 de parâmetros ausentes. O modelo continua separado das confirmações reais de agendamento.

## Confirmação automática no gerenciador

A confirmação de um atendimento dispara a fila imediatamente após o commit. A falha do WhatsApp não desfaz a reserva ou o pagamento. Uma tarefa de recuperação processa confirmações pendentes a cada minuto enquanto o servidor estiver rodando, mesmo com os lembretes desligados; REMINDERS_ENABLED continua controlando o envio periódico dos lembretes.

No cadastro manual, registre a autorização do cliente para WhatsApp e, quando aplicável, marque Sinal recebido por outro meio. Para atendimentos confirmados sem sinal registrado, a agenda oferece Registrar sinal recebido. A gravação é administrativa e preserva a confirmação já enviada, sem duplicar notificações.

Por escolha do usuário, a instalação local está usando jaspers_market_order_confirmation_v1 em en_US para o teste de confirmação automática. O gerenciador identifica esse modo como demonstração em inglês. As três variáveis deste teste são nome do cliente, referência do agendamento com situação do sinal, e data/horário. Para produção, substitua pelo modelo aprovado específico do salão. Os campos opcionais bookingReference e appointmentDateTime estão disponíveis na configuração das variáveis. Nenhum lembrete está habilitado sem um modelo de lembrete configurado.
