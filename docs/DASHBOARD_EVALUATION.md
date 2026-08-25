# Avaliação de dashboards prontos

Spike executado em 25 de agosto de 2026, antes da implementação do Simple Admin. O backend alvo é Medusa 2.19.0, cujo Admin migrou para Vite 7.3.6 e React Router 7.18.2.

| Solução                            | Status             | Versão                | Licença                 | Prós                                           | Contras                                                            | Risco                       | Compatibilidade                         | Decisão               |
| ---------------------------------- | ------------------ | --------------------- | ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------ | --------------------------- | --------------------------------------- | --------------------- |
| `@perier/medusa-dashboard`         | Publicado, recente | 2.17.1                | Não declarada no pacote | Drop-in do dashboard oficial                   | Contrato Medusa 2.17; não cobre a UX Achilles; baixa adoção        | Alto: Vite/Router e licença | Não comprovada no 2.19                  | Não integrar          |
| Mercur                             | Ativo              | 2.2.1 / Medusa 2.17.2 | MIT                     | Admin e portal maduros                         | Impõe marketplace, sellers, offers e mudanças no catálogo/carrinho | Muito alto                  | Incompatível com preservação do domínio | Rejeitar              |
| Medusa Admin + extensões atuais    | Em uso             | 2.19.0                | MIT                     | Compatibilidade oficial e fallback completo    | Menu nativo não atende a simplicidade exigida                      | Baixo como fallback         | Total                                   | Preservar em Avançado |
| Simple Admin fino sobre Admin APIs | Candidato          | Interno               | Código do projeto       | Reusa APIs e permite rollback sem migrar dados | Nova superfície a testar                                           | Médio                       | Compatível por HTTP                     | Implementar           |

Fontes: [pacote Perier](https://www.npmjs.com/package/@perier/medusa-dashboard), [Admin Medusa 2.19](https://docs.medusajs.com/learn/fundamentals/admin), [Mercur](https://github.com/mercurjs/mercur), [releases Mercur](https://github.com/mercurjs/mercur/releases) e [Admin APIs Medusa](https://medusajs.com/admin/).

Nenhuma solução pronta atende 70% da UX sem incompatibilidade séria. A opção escolhida não recria pricing, pedidos, publicação, tracking, compliance ou integrações; apenas compõe endpoints existentes.
