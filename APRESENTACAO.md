# Roteiro da apresentação (7 minutos) e respostas para a banca

Divisão sugerida: uma pessoa por bloco, **todas falam**. Ensaiem com cronômetro; se passar de 7 minutos, cortem a demonstração, não a explicação.

## Antes de entrar (na noite anterior)

- [ ] Apagar o banco e rodar `banco/script.sql` do zero.
- [ ] Clonar o repositório numa pasta nova e seguir o README ao pé da letra.
- [ ] `npm run verificar` na raiz e em `api`: sem erros.
- [ ] `mysqldump taskflow > backup.sql` num pen drive, junto com o projeto.
- [ ] Banco, API e página rodando; `docs/DER.png` aberto numa aba; F12 aberto.
- [ ] Entregar o endereço do GitHub ao professor.

## Roteiro

| Tempo | Quem | O que mostrar |
|---|---|---|
| 2 min | Pessoa 1 | **Demonstração**: criar conta, entrar (Marcelo já tem dados), cadastrar tarefa com tags, filtrar, editar, remover, exportar CSV |
| 2 min | Pessoa 2 | **Banco**: DER; por que tags são tabela e não coluna; ENUM, UNIQUE e CHECK |
| 2 min | Pessoa 3 | **Código**: o clique em "Adicionar" até o banco (veja abaixo) |
| 1 min | Pessoa 4 | **Dificuldade**: um problema real e como resolveram |

### O caminho de um clique (para a Pessoa 3)

1. `src/main.ts`: o `submit` do formulário chama `criarTarefa(dados)`.
2. `src/api.ts`: `enviar()` faz `POST /api/tarefas` com o cabeçalho `Authorization: Bearer <token>`.
3. `api/src/autenticacao.ts`: o porteiro confere o token e guarda o id do dono.
4. `api/src/rotas/tarefas.ts`: a rota entrega o corpo ao serviço.
5. `api/src/servicos/tarefas.ts` + `validacao.ts`: valida; se algo estiver errado, 400.
6. `api/src/dados/tarefas.ts`: `INSERT INTO tarefas ... VALUES (?, ?, ...)` e as tags, tudo numa transação.
7. A resposta volta (201), a página chama `recarregar()` e o painel se atualiza pelo `GROUP BY`.

## A pergunta que separa as apresentações

> "Por que esse filtro está no navegador e aquele está no WHERE?"

- **Status e busca (navegador):** a lista do usuário já está carregada na tela. Filtrar ali é instantâneo, não gasta rede e nem toca no banco. O filtro muda o que é *mostrado*, nunca o que *existe* (por isso o painel continua com o total real).
- **Painel (banco, `GROUP BY`):** conta *todas* as tarefas, não só as visíveis. Com milhares de tarefas, trazer tudo para contar no navegador seria desperdício.
- **"Só atrasadas" (banco, `WHERE prazo < CURDATE()`):** depende da data de hoje e de uma regra sobre os dados; quem decide é o banco, que devolve só as linhas necessárias.
- Regra prática: **poucos dados já carregados → navegador; resumo ou volume grande → banco.**

## Perguntas que a banca costuma fazer

| Pergunta | Resposta e onde mostrar |
|---|---|
| Onde a senha vira hash? Por que não guardar a senha? | `api/src/servicos/usuarios.ts`, `bcrypt.hash(senha, 10)`. Se o banco vazar, o hash não revela a senha; o bcrypt é lento de propósito e usa sal (dois hashes da mesma senha são diferentes). |
| O que impede um usuário de apagar o registro de outro? | `dados/tarefas.ts`: `DELETE FROM tarefas WHERE id = ? AND usuario_id = ?`. O `usuario_id` vem do token assinado. Antes disso, o serviço já responde 404. |
| O que acontece com `' OR '1'='1` na busca? | Nada de especial: vai como **parâmetro** (`LIKE ?`), então é só um texto procurado. Nenhum texto do usuário é concatenado ao SQL. |
| Por que tags estão numa tabela separada? | Relação N:N: uma tarefa tem várias tags e uma tag serve a várias tarefas. Coluna de texto repetiria nomes e impediria JOIN e contagem. |
| Se o banco cair agora, o que o usuário vê? | A API responde 503 e a tela mostra "O banco de dados está indisponível no momento. Tente novamente em instantes." (`servidor.ts`, `tratarErros`). |
| Por que o `.env` não está no repositório? | Tem a senha do banco e o segredo do JWT. Quem tem o segredo pode forjar tokens. Por isso existe o `.env.exemplo`, sem segredos. |
| Por que `Status` é union type? `readonly` no id? `Omit`? `?` | `Status` só aceita 3 valores e um erro de digitação nem compila. `readonly` no `id`/`criadaEm` porque o banco os gera. `NovaTarefa = Omit<Tarefa, "id" \| "criadaEm">` evita repetir a interface. `descricao?` e `prazo?` porque as colunas aceitam NULL. |
| Por que 404 e não 403 para tarefa de outro usuário? | Para nem revelar que aquele id existe. |

## Se der errado

- **MySQL diferente na sala:** leve o `backup.sql` e o script; no MariaDB, troque a collation por `utf8mb4_unicode_ci`.
- **API não sobe:** em computador novo o `.env` não existe: copie `api/.env.exemplo` para `api/.env`.
- **Erro ao vivo:** não esconda. Leia a mensagem em voz alta e diga o que ela significa; saber ler um erro também é avaliado.
- **Acabou o tempo:** pule para o código.
