# Simple Admin — auditoria funcional e estabilização

Data: 2026-08-25

Escopo: Simple Admin (`:3001`) e sua fronteira HTTP com o Commerce (`:9000`).
Nenhum motor comercial, checkout, pagamento, roteamento de fornecedor ou política
de publicação foi substituído ou enfraquecido.

## Diagnóstico do incidente CJ

Medição sanitizada com a CJ real, busca `flashlight`:

| Etapa                 | Resultado        | Tempo observado |
| --------------------- | ---------------- | --------------: |
| GET lista de produtos | HTTP/provider OK |        3.553 ms |
| GET detalhe           | HTTP/provider OK |          264 ms |
| GET variantes         | HTTP/provider OK |          241 ms |

A CJ e as credenciais estavam saudáveis. O defeito reproduzível estava na
fronteira do Simple Admin: `fetch` e proxy sem timeout próprio, feedback restrito
a `ADICIONANDO...` e teste cobrindo apenas respostas instantâneas. Qualquer
requisição que não encerrasse deixava a interface sem um estado terminal.

## Matriz de auditoria

| Tela             | Ação                              | Resultado antes                                     | Bug                                    | Correção                                                  | Resultado depois                                                | Teste                                   |
| ---------------- | --------------------------------- | --------------------------------------------------- | -------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| `/`              | Login correto                     | Entrava                                             | Nenhum no caminho feliz                | Preservado                                                | Entrar leva a Início                                            | Playwright                              |
| `/`              | Senha errada                      | Podia refletir texto técnico                        | Feedback inconsistente                 | Mensagem humana específica                                | “E-mail ou senha incorretos.”                                   | unitário/API                            |
| `/`              | Sessão expirada/401               | Erro sem limpeza e redirecionamento central         | Sessão podia permanecer inválida       | Limpa token, redireciona uma vez e preserva mensagem      | Login reutilizável, sem loop                                    | Playwright                              |
| shell            | Logout                            | Limpava sessão                                      | Nenhum                                 | Preservado                                                | Volta ao login                                                  | Playwright mobile                       |
| `/inicio`        | Métricas reais                    | Backend operacional                                 | Nenhuma fixture na UI                  | Resposta preservada                                       | Publicados, rascunhos, pedidos e vendas vêm do Commerce         | testes do serviço + Playwright          |
| `/inicio`        | Atenções/COMPLETAR                | Deduplicava por produto                             | Nenhum                                 | Preservado                                                | Link abre o produto correto                                     | inspeção + testes existentes            |
| `/vitrine`       | Carregar/null/vazio               | Assumia array válido                                | Payload malformado podia quebrar       | Normalização defensiva para `[]`                          | Estado vazio humano                                             | Playwright + typecheck                  |
| `/vitrine`       | Editar                            | Link apontava para modo inexistente                 | Tela voltava ao cadastro novo          | Editor operacional implementado                           | Nome, descrição, imagem, preço, SKU e disponibilidade persistem | Playwright                              |
| `/vitrine`       | Ativar/publicar                   | Gate existente                                      | Rótulo podia aparecer em publicado     | Ação somente em DRAFT elegível                            | Continua sujeito ao `PublicCatalogPolicy`                       | gates existentes                        |
| `/vitrine`       | Pausar                            | Ausente                                             | Publicado não podia ser pausado        | Atualiza para DRAFT pelo endpoint existente               | UI atualiza sem F5                                              | fluxo implementado/typecheck            |
| `/vitrine`       | Arquivar                          | Funcionava sem progresso                            | Double-click e silêncio pós-ação       | Guarda, confirmação e feedback                            | Atualiza sem F5                                                 | backend existente                       |
| `/vitrine`       | Excluir quando seguro             | Ausente                                             | Operador não alcançava DELETE seguro   | Usa decisão de exclusão existente                         | Rascunho seguro some sem F5; vinculados continuam bloqueados    | Playwright                              |
| `/adicionar`     | Busca CJ                          | Funcionava                                          | Nenhum                                 | Preservada paginação e estados                            | 20/24 e 4/24 no real                                            | teste real + fixtures                   |
| `/adicionar`     | Import CJ                         | Spinner único sem término garantido                 | Loading infinito                       | Etapas, timeout, `finally`, sucesso e erro humanos        | Sempre termina e botão reabilita                                | unitário + Playwright                   |
| `/adicionar`     | Import duplicado                  | Índice único já existia                             | Resposta não apontava o existente      | Retorna `productId` e link                                | “Já está na vitrine”                                            | Playwright + integração                 |
| `/adicionar`     | Vazio/erro/imagem/preço/paginação | Estados básicos presentes                           | Payload malformado não era normalizado | Arrays/totais defensivos; fallbacks preservados           | Nunca mostra JSON/tela branca                                   | Playwright                              |
| `/adicionar`     | Link externo                      | Fluxo assistido existente                           | Sem guarda visual                      | Loading/finally e mensagem honesta                        | Nunca afirma import automático                                  | testes existentes                       |
| `/adicionar`     | Cadastro manual                   | Salvava DRAFT                                       | Sem estado de envio                    | Guarda, loading e `finally`                               | Só título continua válido                                       | Playwright                              |
| `/pedidos`       | Lista vazia/null                  | Vazio existente; array assumido                     | Payload inválido podia quebrar         | Normalização para `[]`                                    | Estado vazio humano                                             | typecheck/Playwright                    |
| `/pedidos`       | Aprovar                           | Funcionava                                          | Sem progresso/sucesso explícito        | Guarda, loading, feedback e refresh aguardado             | Sem duplo envio e sem F5                                        | E2E existente                           |
| `/pedidos`       | Tracking                          | Funcionava                                          | Labels frágeis e sem progresso         | Labels semânticos, guarda e feedback                      | Persistência preservada                                         | E2E existente                           |
| `/clientes`      | Vazio/null                        | Tabela vazia sem explicação                         | Sem empty state; array assumido        | Normalização e mensagem vazia                             | Campos null seguros                                             | Playwright mobile/typecheck             |
| `/configuracoes` | Cards/links                       | Cards pareciam não acionáveis                       | Botões mortos por omissão              | Ação explícita para Avançado                              | Nenhuma promessa falsa                                          | Playwright mobile                       |
| `/avancado`      | Links                             | Pricing apontava para rota inexistente e faltava CJ | 404 operacional                        | Pricing aponta a Produtos e CJ à rota existente           | Destinos válidos                                                | inspeção + Playwright mobile            |
| proxy            | Métodos/erros                     | GET/POST/DELETE sem timeout                         | PATCH/PUT ausentes e espera indefinida | Timeout 50 s, 503/504, PATCH/PUT, status/body preservados | Falha sempre encerra                                            | unitário/API + build                    |
| global           | Ações assíncronas                 | Cobertura desigual                                  | Spinner/double-click possível          | Guardas e `finally` nas mutações auditadas                | Sucesso, erro ou timeout                                        | unitário + Playwright                   |
| responsivo       | 390×844                           | Layout existente                                    | Nenhum bloqueio encontrado             | Sem redesign                                              | Rotas e logout acessíveis                                       | Playwright + console/pageerror estritos |

## Segurança e limites preservados

- CJ, Alibaba e credenciais não foram alterados.
- `SupplierRouter`, Pricing Engine, `PublicCatalogPolicy`, compliance, checkout,
  pagamento, shipping e tracking não foram enfraquecidos.
- Criação e pagamento automático de pedido ao fornecedor permanecem desligados.
- O Simple Admin não ativa fornecedor pendente nem aprova compliance sozinho.
- Restore de arquivado permanece fora do fluxo simples porque o backend não
  expõe hoje uma operação segura de restauração.

## Validação manual real

A consulta real CJ foi executada e medida sem registrar segredo. A criação real
no banco operacional exige sessão administrativa autenticada; nenhuma sessão
reutilizável estava disponível ao agente. Para não criar credencial temporária
nem alterar o banco operacional, a importação completa foi validada no banco E2E
isolado com fixture fiel ao payload real. A validação real assistida deve ser
repetida por um operador autenticado antes do merge do PR.
