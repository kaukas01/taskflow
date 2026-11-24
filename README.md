# TaskFlow

Gerenciador de tarefas no navegador: cada pessoa cria conta, entra e organiza as próprias tarefas, com painel, filtros, busca, tags e exportação para CSV.
Projeto da disciplina — Grupo Anchieta, 2026. Grupo: ______________ (integrantes).

![Tela principal](docs/tela.png)

## Como rodar

Requisitos: Node.js 20.19 ou superior (recomendado 22) e MySQL 8 (ou MariaDB 10.5+).

1. Crie o banco: rode `banco/script.sql` no MySQL Workbench (ele apaga e recria o banco `taskflow`, já com dados de exemplo).
2. Na pasta `api`: copie `.env.exemplo` para `.env` e preencha a senha do MySQL (`DB_SENHA`) e um `JWT_SEGREDO`.
3. Na pasta `api`: `npm install` e depois `npm run dev`.
4. Em outro terminal, na pasta do projeto: `npm install` e depois `npm run dev`.
5. Abra http://localhost:5173 e entre com o usuário de demonstração.

**Usuário de demonstração:** `marcelo@email.com` / `senha123` (6 tarefas: painel 6 total, 4 pendentes, 1 em andamento, 1 concluída). Também existem `joao@email.com` e `maria@email.com`, com a mesma senha.

No MariaDB, se der erro de collation, troque `utf8mb4_unicode_ci` por outra suportada no topo do script.

### Comandos úteis

| Onde | Comando | Para quê |
|---|---|---|
| raiz e `api` | `npm run verificar` | confere os tipos do TypeScript (deve passar sem erros) |
| `api` | `npm run teste` | roda os testes da validação |
| `api` | `GET /api/saude` | confere se API e banco estão de pé |

## Estrutura

```
taskflow/
├── banco/script.sql        o banco: tabelas, restrições e dados de exemplo
├── docs/                   DER (DER.png, fonte em DER.mmd), print e roteiro da apresentação
├── index.html              a página
├── src/                    a página (TypeScript + Vite)
│   ├── tipos.ts            Tarefa, Status, Prioridade... (o "contrato" com a API)
│   ├── api.ts              todos os fetch + sessão (token no localStorage)
│   ├── servicos.ts         filter, some, every, reduce, sort, CSV (funções puras)
│   ├── main.ts             estado, desenho na tela e eventos
│   └── estilo.css
└── api/                    a API (Express + mysql2)
    ├── .env.exemplo        modelo das variáveis (o .env real NÃO vai para o Git)
    ├── src/
    │   ├── servidor.ts     liga tudo e trata os erros (códigos HTTP)
    │   ├── rotas/          camada HTTP: lê o pedido, escolhe o código de resposta
    │   ├── servicos/       camada de regras: valida, decide, lança erros
    │   ├── dados/          camada de dados: todo o SQL, sempre parametrizado
    │   ├── validacao.ts    validação da entrada
    │   ├── autenticacao.ts token JWT e o middleware "porteiro"
    │   └── banco.ts, config.ts, erros.ts, tipos.ts
    └── testes/             testes da validação
```

## Banco de dados

![DER](docs/DER.png)

- 4 tabelas: `usuarios`, `tarefas`, `tags` e `tarefa_tag` (relação N:N).
- Chaves estrangeiras com `ON DELETE CASCADE`; `ENUM` em prioridade e status; `UNIQUE` em `usuarios.email` e em `tags(usuario_id, nome)`; `CHECK` no título.
- Tags são uma **tabela** e não uma coluna de texto: assim o nome existe uma vez só (sem duplicação) e dá para fazer JOIN e contagem.

## Requisitos atendidos

| Requisito | Onde está |
|---|---|
| 3+ tabelas, FK e ENUM/CHECK | `banco/script.sql` |
| DER em imagem | `docs/DER.png` |
| Cadastro e login, senha em hash | `api/src/servicos/usuarios.ts` (bcrypt) |
| CRUD completo gravando no MySQL | `api/src/rotas/tarefas.ts` → `servicos` → `dados` |
| Listagem com filtro e busca | status e busca por título/tag no navegador; "Só atrasadas" no banco |
| Painel com números calculados | 4 números por `GROUP BY` em `GET /api/estatisticas` |
| JOIN / GROUP BY | `dados/tarefas.ts` (tags por subconsulta com JOIN e `GROUP_CONCAT`; painel por `GROUP BY`) |
| Consultas parametrizadas | todas usam `?`; nenhum texto do usuário é concatenado ao SQL |
| `npm run verificar` | passa na raiz e em `api` |
| README e `.env.exemplo` | este arquivo e `api/.env.exemplo` |
| Diferencial do grupo | exportar CSV do que está na tela; tags editáveis no formulário e buscáveis |

## Segurança

- Senha guardada só como hash bcrypt; e-mail inexistente e senha errada dão a mesma mensagem.
- Token JWT (8 h); o `usuario_id` vem **do token**, nunca de um campo enviado pela página.
- Toda consulta de tarefa filtra `WHERE ... usuario_id = ?`: cada pessoa só vê e altera o que é seu. Tarefa de outra pessoa responde 404.
- `.env` está no `.gitignore`; a página monta o HTML com `textContent` (sem `innerHTML`).

## Rotas da API

| Método e rota | Resposta |
|---|---|
| `POST /api/usuarios` | 201, 400 (dados inválidos), 409 (e-mail repetido) |
| `POST /api/login` | 200 `{ token, nome }`, 400, 401 |
| `GET /api/eu` | 200 (id, nome, e-mail) |
| `GET /api/tarefas?status=&busca=&atrasadas=` | 200, 400 |
| `GET /api/tarefas/:id` | 200, 404 |
| `POST /api/tarefas` | 201, 400 |
| `PATCH /api/tarefas/:id` | 200, 400, 404 |
| `DELETE /api/tarefas/:id` | 204, 404 |
| `GET /api/estatisticas` | 200 `{ pendente, em_andamento, concluida }` |

Sem token: 401. Banco fora do ar: 503 com mensagem amigável.
