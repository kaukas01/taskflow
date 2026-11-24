// Os tipos da página. Espelham os da API (api/src/tipos.ts): é o "contrato".

// Os valores válidos num array "as const": dele sai o union type.
// Um status fora da lista (ex.: "feita") nem compila.
export const STATUS = ["pendente", "em_andamento", "concluida"] as const;
export type Status = (typeof STATUS)[number];

export const PRIORIDADES = ["alta", "media", "baixa"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export interface Tarefa {
  readonly id: number; // readonly: o id vem do banco e nunca é reatribuído
  titulo: string;
  descricao?: string; // opcional: a coluna aceita NULL
  prioridade: Prioridade;
  status: Status;
  prazo?: string; // "AAAA-MM-DD"
  readonly criadaEm: string; // quem decide é o banco
  tags: string[];
}

// O que o formulário envia para criar: a Tarefa menos o que o banco gera.
export type NovaTarefa = Omit<Tarefa, "id" | "criadaEm">;

// O que se envia para editar: qualquer parte da NovaTarefa.
// Texto vazio em descricao ou prazo apaga o valor.
export type Alteracao = Partial<NovaTarefa>;

// Filtros que viram WHERE no banco (os de navegador não passam pela API).
export interface FiltroBanco {
  atrasadas?: boolean;
}

// O painel. Record garante que as três chaves existam.
export type Contagem = Record<Status, number>;

// Quem está logado. A API devolve isto no login.
export interface Sessao {
  token: string;
  nome: string;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
}
