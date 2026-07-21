# Fase 7.2 — Inteligência Operacional

Estado: **concluída e aprovada na validação final em 21 de julho de 2026**.

## Escopo entregue

- proposta semanal automática e determinística a partir de uma seleção explícita de Resultados aprovados;
- marcação manual de produtos prioritários, posicionados antes dos demais;
- alternância de categorias quando existem alternativas, com desempate estável por data e ID;
- rejeição de `sourceResultId` duplicado e limite de 21 itens por proposta;
- distribuição previsível em segunda a domingo, nos horários fixos 10:00, 15:00 e 19:00;
- estados editoriais `planned`, `ready` e `published`, separados do estado técnico de renderização;
- card de próxima publicação e identificação visual de itens atrasados;
- acesso direto da operação de Stories ao Resultado original;
- categoria e estado no Calendário;
- totais editoriais, categorias e data de aprovação no Histórico;
- encerramento explícito da semana, persistindo `status: closed` e bloqueando mutações.

## Regras determinísticas

A proposta usa apenas os itens enviados pelo usuário. O backend valida todos como Resultados aprovados, normaliza a identificação do produto e processa dois grupos estáveis: prioritários e demais. Dentro de cada grupo, alterna categorias sempre que possível e evita produtos iguais em sequência quando existe alternativa. Não há IA, aleatoriedade, OpenRouter ou fallback silencioso.

Os layouts são distribuídos na ordem versionada `product-highlight`, `minimal` e `offer`. Os primeiros sete itens ocupam dias consecutivos às 10:00; os próximos ciclos usam 15:00 e 19:00. A proposta só é aplicada a uma semana vazia, evitando mescla implícita com planejamento manual existente.

## Compatibilidade

- nenhum campo existente foi removido ou renomeado;
- `renderStatus` permanece responsável pelo estado técnico `pending | ready | failed`;
- `editorialStatus` é aditivo e representa `planned | ready | published`;
- Stories antigos sem estado editorial são exibidos como `ready` quando já renderizados e `planned` nos demais casos;
- categoria vem do snapshot persistido no Resultado (`templateCategory`) e usa `sem-categoria` quando ausente;
- a cópia local da fonte continua sendo a autoridade histórica visual.

## Validação executada

- 46 arquivos e 330 testes aprovados;
- build Vite aprovado com 1.826 módulos transformados;
- proposta criada pela interface com três Resultados e um prioritário;
- ordem e agenda determinísticas confirmadas;
- Calendário, próxima publicação, Histórico e acesso ao Resultado confirmados;
- thumbnails preservadas no Calendário, sem crop;
- semana encerrada confirmada como somente leitura, mantendo downloads e permitindo apenas sua exclusão explícita com confirmação;
- desktop e mobile (390×844) sem overflow horizontal;
- dados temporários removidos ao final;
- nenhuma chamada ao OpenRouter e zero créditos consumidos.

## Validação final

A semana temporária percorreu proposta, três renderizações, edição estrutural, aprovação, retorno automático a `draft`, nova aprovação, publicação, encerramento, persistência após reinício, consulta histórica, download e exclusão controlada. `week.json` e backup permaneceram válidos, sem Base64 ou caminhos absolutos. Nenhum Resultado real foi removido.
