# Achilles Store — Control Center local

## Uso normal no Windows

Dê duplo clique somente em:

`ACHILLES_STORE.bat`

O menu controla toda a operação local sem exigir conhecimento de Docker,
PowerShell, processos, portas ou ferramentas de desenvolvimento.

## Operação

- **LIGAR TUDO** reutiliza o PostgreSQL existente, executa migrations e a
  estrutura idempotente e inicia apenas os serviços que estiverem desligados.
- **DESLIGAR TUDO** encerra somente processos registrados da Achilles e pergunta
  se o banco local também deve ser desligado. O volume nunca é removido.
- **REINICIAR SERVIÇOS** preserva PostgreSQL e reinicia apenas Backend, Loja e
  Painel Admin.
- **STATUS** valida PostgreSQL e os healthchecks HTTP da Loja, Painel Admin e
  Backend. Apenas respostas HTTP 2xx são consideradas online.

Após ligar ou reiniciar, o painel mostra o status final. Se um serviço não
responder, consulte `.logs/commerce.log`, `.logs/storefront.log`,
`.logs/admin.log` e `.logs/launcher.log`.

## Manutenção

- **ATUALIZAR PROJETO** exige worktree limpo, usa fast-forward, instala pelo
  lockfile, executa migrations, estrutura idempotente e typecheck. Depois oferece
  reiniciar apenas os serviços Achilles.
- **CONFIGURAÇÃO INICIAL / REPARAR** valida Node 24, pnpm, Docker, `.env`, banco,
  dependências, migrations, estrutura e TypeScript. Nunca executa seed demo.
- **MODO DEBUG** abre os consoles técnicos; a operação comum continua oculta.
- **ABRIR LOGS** abre a pasta `.logs`, criando-a quando necessário.

## Acessos e inicialização

Os acessos rápidos verificam saúde antes de abrir:

- Loja: `http://localhost:3000`
- Painel Admin: `http://localhost:3001`
- Admin Avançado: `http://localhost:9000/app`

Quando um serviço está desligado, o painel oferece iniciar a Achilles Store.
O autostart chama `ACHILLES_STORE.bat --start`, sem abrir o menu ou esperar
entrada. A opção de atalho cria somente **ACHILLES STORE** na Área de Trabalho.

## Automação

O mesmo ponto de entrada aceita:

```text
ACHILLES_STORE.bat --start
ACHILLES_STORE.bat --stop
ACHILLES_STORE.bat --restart
ACHILLES_STORE.bat --status
ACHILLES_STORE.bat --update
ACHILLES_STORE.bat --setup
ACHILLES_STORE.bat --debug
```

O BAT contém apenas menu, roteamento e acessos. Toda lógica operacional e de
segurança permanece em `scripts/launcher/achilles-launcher.ps1`, incluindo a
proteção contra banco E2E, PIDs estranhos, portas ocupadas, logs sanitizados,
migrations, estrutura mínima e volumes PostgreSQL.
