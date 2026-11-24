-- =====================================================================
-- TaskFlow — script do banco de dados (MySQL 8 / MariaDB 10.5+)
--
-- Roda do zero: apaga o banco "taskflow" se existir, recria tudo e
-- insere dados de demonstração. Para recomeçar, é só rodar de novo.
-- Se o script falhar, conserte o script — não o banco.
-- =====================================================================

DROP DATABASE IF EXISTS taskflow;
CREATE DATABASE taskflow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE taskflow;

-- ---------------------------------------------------------------------
-- usuarios: quem tem conta. A senha NUNCA é guardada: só o hash bcrypt.
-- UNIQUE (email): é o banco que recusa e-mail repetido (ER_DUP_ENTRY).
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome       VARCHAR(100)  NOT NULL,
  email      VARCHAR(150)  NOT NULL,
  senha_hash VARCHAR(100)  NOT NULL,
  criado_em  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- tarefas: a entidade principal. Cada tarefa pertence a UM usuário.
-- ENUM: o banco só aceita os valores previstos para prioridade e status
-- (são os mesmos union types do TypeScript).
-- CHECK: o título não pode ser só espaços.
-- ON DELETE CASCADE: apagar o usuário apaga as tarefas dele.
-- ---------------------------------------------------------------------
CREATE TABLE tarefas (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED  NOT NULL,
  titulo     VARCHAR(120)  NOT NULL,
  descricao  VARCHAR(500)  NULL,
  prioridade ENUM('alta', 'media', 'baixa')                  NOT NULL DEFAULT 'media',
  status     ENUM('pendente', 'em_andamento', 'concluida')   NOT NULL DEFAULT 'pendente',
  prazo      DATE          NULL,
  criada_em  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_tarefas_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT ck_tarefas_titulo CHECK (CHAR_LENGTH(TRIM(titulo)) > 0),
  -- as consultas sempre filtram por dono (e muitas por status)
  INDEX ix_tarefas_usuario_status (usuario_id, status)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- tags: rótulos de cada usuário (Trabalho, Casa...).
-- UNIQUE (usuario_id, nome): o mesmo nome não se repete para a mesma
-- pessoa — a tag existe uma vez só, sem duplicação.
-- ---------------------------------------------------------------------
CREATE TABLE tags (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED  NOT NULL,
  nome       VARCHAR(30)   NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tags_usuario_nome (usuario_id, nome),
  CONSTRAINT fk_tags_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- tarefa_tag: relação N:N. Uma tarefa tem várias tags e uma tag serve a
-- várias tarefas. Por isso é TABELA e não coluna: uma coluna "tags" com
-- texto separado por vírgula repetiria nomes e impediria JOIN/contagem.
-- ---------------------------------------------------------------------
CREATE TABLE tarefa_tag (
  tarefa_id INT UNSIGNED NOT NULL,
  tag_id    INT UNSIGNED NOT NULL,
  PRIMARY KEY (tarefa_id, tag_id),
  CONSTRAINT fk_tarefa_tag_tarefa FOREIGN KEY (tarefa_id)
    REFERENCES tarefas (id) ON DELETE CASCADE,
  CONSTRAINT fk_tarefa_tag_tag FOREIGN KEY (tag_id)
    REFERENCES tags (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- =====================================================================
-- DADOS DE DEMONSTRAÇÃO
-- Os três usuários têm a senha "senha123" (o mesmo hash bcrypt copiado,
-- o do material da Aula 5). Contas criadas pela API recebem hashes
-- diferentes, porque o bcrypt sorteia um sal novo a cada vez.
-- =====================================================================
INSERT INTO usuarios (nome, email, senha_hash) VALUES
  ('Marcelo Macrino', 'marcelo@email.com', '$2b$10$mDxl2ubcI7O/KrG/h4H0n.Pok4jKJZfmh4ROQPSiWszf340mDT9e.'),
  ('João Silva',      'joao@email.com',    '$2b$10$mDxl2ubcI7O/KrG/h4H0n.Pok4jKJZfmh4ROQPSiWszf340mDT9e.'),
  ('Maria Souza',     'maria@email.com',   '$2b$10$mDxl2ubcI7O/KrG/h4H0n.Pok4jKJZfmh4ROQPSiWszf340mDT9e.');

INSERT INTO tags (usuario_id, nome)
SELECT u.id, n.nome
  FROM usuarios u
  JOIN (SELECT 'Urgente' AS nome UNION ALL SELECT 'Trabalho' UNION ALL SELECT 'Casa') n
 WHERE u.email = 'marcelo@email.com';

INSERT INTO tags (usuario_id, nome)
SELECT id, 'Estudo' FROM usuarios WHERE email = 'joao@email.com';

-- As seis tarefas do Marcelo (painel: 6 no total, 4 pendentes,
-- 1 em andamento, 1 concluída; a alta pendente acende o aviso amarelo)
INSERT INTO tarefas (usuario_id, titulo, descricao, prioridade, status, prazo) VALUES
  (1, 'Finalizar projeto Chronos',   'Terminar a API em Node.js',  'alta',  'em_andamento', '2026-11-15'),
  (1, 'Comprar telescópio novo',     'Pesquisar modelos SVBONY',   'baixa', 'concluida',    '2026-10-30'),
  (1, 'Preparar a apresentação',     'Slides para a Aula 7',       'alta',  'pendente',     '2026-11-25'),
  (1, 'Estudar TypeScript avançado', NULL,                         'media', 'pendente',     NULL),
  (1, 'Revisar o orçamento',         NULL,                         'media', 'pendente',     '2026-11-20'),
  (1, 'Organizar a garagem',         NULL,                         'baixa', 'pendente',     NULL);

INSERT INTO tarefas (usuario_id, titulo, descricao, prioridade, status, prazo)
SELECT id, 'Estudar para a prova de SQL', 'Revisar JOIN e GROUP BY', 'alta', 'pendente', '2026-11-26'
  FROM usuarios WHERE email = 'joao@email.com';

INSERT INTO tarefas (usuario_id, titulo, descricao, prioridade, status, prazo)
SELECT id, 'Planejar a viagem de fim de ano', NULL, 'media', 'em_andamento', NULL
  FROM usuarios WHERE email = 'maria@email.com';

-- Liga as tags do Marcelo às tarefas pelo NOME (os ids não são adivinhados)
INSERT INTO tarefa_tag (tarefa_id, tag_id)
SELECT t.id, g.id
  FROM tarefas t
  JOIN tags g ON g.usuario_id = t.usuario_id
 WHERE t.usuario_id = 1
   AND (   (t.titulo = 'Finalizar projeto Chronos' AND g.nome IN ('Urgente', 'Trabalho'))
        OR (t.titulo = 'Comprar telescópio novo'   AND g.nome = 'Casa')
        OR (t.titulo = 'Preparar a apresentação'   AND g.nome = 'Trabalho')
        OR (t.titulo = 'Revisar o orçamento'       AND g.nome = 'Trabalho')
        OR (t.titulo = 'Organizar a garagem'       AND g.nome = 'Casa'));

INSERT INTO tarefa_tag (tarefa_id, tag_id)
SELECT t.id, g.id
  FROM tarefas t
  JOIN tags g ON g.usuario_id = t.usuario_id AND g.nome = 'Estudo'
 WHERE t.titulo = 'Estudar para a prova de SQL';

-- Conferência: Marcelo deve ter pendente 4, em_andamento 1, concluida 1
SELECT status, COUNT(*) AS quantidade FROM tarefas WHERE usuario_id = 1 GROUP BY status;
