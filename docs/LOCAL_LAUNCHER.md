# Launcher local

## Primeira configuração

Clique em `SETUP_ACHILLES.bat`. Ele valida Node 24, pnpm, Docker, `.env`, instala pelo lockfile, sobe o PostgreSQL existente, espera o healthcheck, executa migrations e typecheck. Nenhum seed demo é executado.

## Uso diário

- `START_ACHILLES.bat`: inicia banco, backend, storefront e Simple Admin.
- `STOP_ACHILLES.bat`: encerra apenas PIDs registrados e oferece desligar o banco sem remover volume.
- `RESTART_ACHILLES.bat`: reinicia preservando o banco.
- `STATUS_ACHILLES.bat`: consulta portas e healthchecks.
- `START_ACHILLES_DEBUG.bat`: abre consoles técnicos.

O launcher aborta para banco E2E, porta externa ocupada ou `.env` ausente. START não instala dependências nem executa Git. Logs sanitizados ficam em `.logs/` e PIDs em `.runtime/`.

`UPDATE_ACHILLES.bat` exige árvore limpa e usa fast-forward, lockfile, migrations e typecheck. O autostart só é ativado após confirmação. Os launchers são exclusivamente locais.
