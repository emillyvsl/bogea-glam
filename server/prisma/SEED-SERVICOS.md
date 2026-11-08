# Substituir o catálogo

Execute na raiz: `npm run db:seed:services`.

O comando cria/atualiza os 30 serviços nas 9 categorias solicitadas. Não cria usuários. O seed geral de usuário permanece independente. O seed geral também usa o catálogo novo em bancos vazios e não recria os serviços antigos. Para remover o catálogo anterior de um banco existente, use o comando específico acima.

O seed é transacional e pode ser executado novamente sem duplicar serviços. Recusa a alteração se houver reserva aguardando pagamento dentro do prazo. Serviços usados por agendamentos são preservados como inativos; os demais antigos são removidos. Agendamentos existentes, valores históricos, protocolos e pagamentos não são alterados. Categorias antigas ficam disponíveis para reutilização.

Profissionais configurados para todos os serviços recebem automaticamente os novos. Os que têm serviços específicos precisam de revisão no gerenciador, sem conceder habilidades automaticamente.

Mechas loiras: preço inicial R$ 500,00, duração 6 horas e descrição da faixa até R$ 600,00. O sinal online é calculado sobre R$ 500,00. O sistema ainda não calcula variação de preço por comprimento.

Durações de 15, 30, 40, 45 e 50 minutos são preservadas. Para horários que atravessam o almoço, o motor soma o intervalo e exige término antes do fechamento; um serviço de 8 horas depende de um expediente com tempo útil suficiente.


## Nomes e adicionais

Os nomes exibidos incluem o contexto: Escova curta/média/longa, Penteado com/sem escova, Maquiagem express/social, Penteado/Maquiagem para noiva e Curso de [...]. O seed reconhece os nomes anteriores dentro da categoria para preservar os IDs ao renomear.

São 28 serviços principais e 2 adicionais. ADICIONAIS é reservado aos complementos: não aparecem como serviços agendáveis isoladamente e só são selecionados depois de um serviço principal. Valor e duração dos adicionais são somados à reserva, exigindo um profissional habilitado para todo o atendimento. Trocar o principal limpa os adicionais. O servidor também rejeita reserva composta apenas de adicionais.
