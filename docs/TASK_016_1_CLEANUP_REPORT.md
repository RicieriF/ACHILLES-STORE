# TASK 016.1 — Relatório de limpeza

## Escopo executado

A limpeza foi acionada explicitamente por `pnpm clean:test-data`. Nenhum hook de
inicialização ou execução automática foi adicionado.

Os registros foram selecionados somente por marcadores técnicos de fixture, como
`provider = TEST`, metadados de seed/fixture, URLs `example.invalid`, SKUs de
candidatos controlados e relações com pedidos de teste. Nome e e-mail nunca são
critérios de exclusão.

## Resultado local

Na primeira execução foram removidos, entre outros registros relacionados:

- 9 pedidos de teste;
- 11 intents de pagamento `TEST`;
- 18 checkouts de fixture;
- 9 carrinhos de fixture;
- 50 produtos marcados, incluindo os dois candidatos controlados;
- 2 pedidos de fornecedor sandbox;
- 11 ofertas de fixture;
- 3 clientes sem conta e exclusivamente ligados a pedidos de teste;
- 2 fornecedores de seed sem ofertas reais ativas.

A segunda execução retornou zero para todas as 15 categorias contabilizadas,
confirmando idempotência.

## Preservação verificada

- 3 usuários administradores permaneceram ativos;
- 8 categorias oficiais permaneceram ativas;
- o produto controle sem marcador técnico permaneceu ativo;
- o fornecedor CJ configurado e não marcado como seed permaneceu ativo;
- nenhum produto `ACH-CAND-*`, produto de fixture ou intent `TEST` permaneceu
  ativo.

## Proteções ambientais

- `production` é sempre bloqueado;
- apenas `development` e `test` são permitidos por padrão;
- `staging` exige `ALLOW_STAGING_TEST_DATA_CLEANUP=true` explicitamente;
- ambientes vazios ou desconhecidos são rejeitados.
