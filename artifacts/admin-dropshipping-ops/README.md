# ACHILLES Admin — Dropshipping Operations Center

Evidências geradas pelo teste Playwright autenticado em
`tests/e2e/admin-operations.spec.ts`:

- `dashboard.png`: indicadores, situação do catálogo, providers e alertas;
- `catalog-cards.png`: catálogo visual com estado operacional derivado;
- `quick-create.png`: cadastro rápido em cinco etapas, sempre DRAFT;
- `quick-edit.png`: edição rápida com aviso explícito de DRAFT;
- `product-operations.png`: widget operacional no Product Detail nativo;
- `extensions.png`: estado sanitizado de serviços e extensões.

As fixtures usadas para gerar as imagens possuem a marca
`achilles_test_fixture` e são removidas por `pnpm clean:test-data`.
