// Os tipos do domínio. Os valores válidos ficam num array "as const": dele
// sai o union type (para o TypeScript) e a lista usada na validação (em
// tempo de execução). Uma fonte só — não dá para os dois divergirem.
export const STATUS = ["pendente", "em_andamento", "concluida"] as const;
export type Status = (typeof STATUS)[number];

export const PRIORIDADES = ["alta", "media", "baixa"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export interface Tarefa {
  readonly id: number; // readonly: o id nasce no banco e nunca é reatribuído
  titulo: string;
  descricao?: string; // opcional: a coluna aceita NULL
  prioridade: Prioridade;
  status: Status;
  prazo?: string; // "AAAA-MM-DD"; opcional, como a coluna
  readonly criadaEm: string; // quem decide é o banco (DEFAULT CURRENT_TIMESTAMP)
  tags: string[];
}

// O que o cliente envia para criar: tudo da Tarefa, menos o que o banco gera.
export type NovaTarefa = Omit<Tarefa, "id" | "criadaEm">;

// O que o cliente envia para alterar: só os campos que mudam.
// Texto vazio (null aqui dentro) em descrição e prazo apaga o valor (NULL no banco).
export type Alteracao = Partial<Omit<NovaTarefa, "descricao" | "prazo">> & {
  descricao?: string | null;
  prazo?: string | null;
};

// Filtros da listagem, já validados (viram WHERE no banco).
export interface FiltroTarefas {
  status?: Status;
  busca?: string;
  atrasadas: boolean;
}

// O painel: quantas tarefas em cada status. Record garante as três chaves.
export type Contagem = Record<Status, number>;

export interface Cadastro {
  nome: string;
  email: string;
  senha: string;
}

export interface UsuarioPublico {
  id: number;
  nome: string;
  email: string; // nunca o senha_hash
}
