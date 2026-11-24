import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ErroHttp } from "../src/erros";
import {
  dataValida,
  validarAlteracao,
  validarCadastro,
  validarFiltro,
  validarId,
  validarNovaTarefa,
} from "../src/validacao";

function recusaCom(funcao: () => unknown, status: number): void {
  assert.throws(funcao, (erro: unknown) => erro instanceof ErroHttp && erro.status === status);
}

describe("validarNovaTarefa", () => {
  it("aceita só o título e preenche os padrões", () => {
    assert.deepEqual(validarNovaTarefa({ titulo: "  Estudar SQL  " }), {
      titulo: "Estudar SQL",
      prioridade: "media",
      status: "pendente",
      tags: [],
    });
  });

  it("aceita todos os campos e tira repetição de tags (sem diferenciar maiúsculas)", () => {
    const tarefa = validarNovaTarefa({
      titulo: "Revisar",
      descricao: "ver o orçamento",
      prioridade: "alta",
      status: "em_andamento",
      prazo: "2026-11-20",
      tags: ["Trabalho", " trabalho ", "Casa", ""],
    });
    assert.equal(tarefa.descricao, "ver o orçamento");
    assert.equal(tarefa.prazo, "2026-11-20");
    assert.deepEqual(tarefa.tags, ["Trabalho", "Casa"]);
  });

  it("descrição e prazo vazios somem do objeto", () => {
    const tarefa = validarNovaTarefa({ titulo: "x", descricao: "", prazo: "" });
    assert.equal("descricao" in tarefa, false);
    assert.equal("prazo" in tarefa, false);
  });

  it("recusa título vazio, só espaços, grande demais ou de outro tipo (400)", () => {
    recusaCom(() => validarNovaTarefa({}), 400);
    recusaCom(() => validarNovaTarefa({ titulo: "   " }), 400);
    recusaCom(() => validarNovaTarefa({ titulo: "a".repeat(121) }), 400);
    recusaCom(() => validarNovaTarefa({ titulo: 42 }), 400);
  });

  it("recusa prioridade, status e prazo inválidos (400)", () => {
    recusaCom(() => validarNovaTarefa({ titulo: "x", prioridade: "urgentissima" }), 400);
    recusaCom(() => validarNovaTarefa({ titulo: "x", status: "feita" }), 400);
    recusaCom(() => validarNovaTarefa({ titulo: "x", prazo: "20/11/2026" }), 400);
    recusaCom(() => validarNovaTarefa({ titulo: "x", prazo: "2026-02-31" }), 400);
  });

  it("recusa tags demais, com vírgula, grandes demais ou que não são lista (400)", () => {
    recusaCom(() => validarNovaTarefa({ titulo: "x", tags: ["a", "b", "c", "d", "e", "f"] }), 400);
    recusaCom(() => validarNovaTarefa({ titulo: "x", tags: ["a,b"] }), 400);
    recusaCom(() => validarNovaTarefa({ titulo: "x", tags: ["a".repeat(31)] }), 400);
    recusaCom(() => validarNovaTarefa({ titulo: "x", tags: "casa" }), 400);
  });

  it("recusa corpo que não é objeto (400)", () => {
    recusaCom(() => validarNovaTarefa(undefined), 400);
    recusaCom(() => validarNovaTarefa(null), 400);
    recusaCom(() => validarNovaTarefa("texto"), 400);
    recusaCom(() => validarNovaTarefa([]), 400);
  });
});

describe("validarAlteracao", () => {
  it("devolve só o que veio", () => {
    assert.deepEqual(validarAlteracao({ status: "concluida" }), { status: "concluida" });
  });

  it("texto vazio em descrição e prazo vira null (apaga no banco)", () => {
    assert.deepEqual(validarAlteracao({ descricao: "", prazo: "" }), { descricao: null, prazo: null });
  });

  it("recusa pedido sem nenhum campo e valores inválidos (400)", () => {
    recusaCom(() => validarAlteracao({}), 400);
    recusaCom(() => validarAlteracao({ status: "feita" }), 400);
    recusaCom(() => validarAlteracao({ titulo: "" }), 400);
  });
});

describe("validarId", () => {
  it("aceita inteiros positivos", () => {
    assert.equal(validarId("7"), 7);
  });
  it("recusa o resto (400)", () => {
    for (const ruim of ["0", "-1", "1.5", "abc", "1 OR 1=1", "", "99999999999999999999"]) {
      recusaCom(() => validarId(ruim), 400);
    }
  });
});

describe("validarFiltro", () => {
  it("sem nada: só atrasadas = false", () => {
    assert.deepEqual(validarFiltro({}), { atrasadas: false });
  });
  it("lê status, busca (com trim) e atrasadas", () => {
    assert.deepEqual(validarFiltro({ status: "pendente", busca: " rev ", atrasadas: "true" }), {
      status: "pendente",
      busca: "rev",
      atrasadas: true,
    });
  });
  it("busca vazia é ignorada", () => {
    assert.deepEqual(validarFiltro({ busca: "   " }), { atrasadas: false });
  });
  it("o texto de injeção de SQL é só um texto qualquer (vai por parâmetro)", () => {
    assert.equal(validarFiltro({ busca: "' OR '1'='1" }).busca, "' OR '1'='1");
  });
  it("recusa status inválido, lista repetida e atrasadas estranho (400)", () => {
    recusaCom(() => validarFiltro({ status: "x" }), 400);
    recusaCom(() => validarFiltro({ status: ["pendente", "concluida"] }), 400);
    recusaCom(() => validarFiltro({ busca: ["a", "b"] }), 400);
    recusaCom(() => validarFiltro({ atrasadas: "sim" }), 400);
  });
});

describe("validarCadastro", () => {
  it("normaliza nome e e-mail", () => {
    assert.deepEqual(validarCadastro({ nome: " Ana ", email: " ANA@Email.com ", senha: "123456" }), {
      nome: "Ana",
      email: "ana@email.com",
      senha: "123456",
    });
  });
  it("recusa nome vazio, e-mail inválido e senha curta ou longa demais (400)", () => {
    recusaCom(() => validarCadastro({ nome: "", email: "a@b.co", senha: "123456" }), 400);
    recusaCom(() => validarCadastro({ nome: "Ana", email: "ana", senha: "123456" }), 400);
    recusaCom(() => validarCadastro({ nome: "Ana", email: "a@b.co", senha: "12345" }), 400);
    recusaCom(() => validarCadastro({ nome: "Ana", email: "a@b.co", senha: "x".repeat(73) }), 400);
  });
});

describe("dataValida", () => {
  it("confere formato e existência da data", () => {
    assert.equal(dataValida("2026-11-24"), true);
    assert.equal(dataValida("2028-02-29"), true); // bissexto
    assert.equal(dataValida("2026-02-29"), false);
    assert.equal(dataValida("2026-13-01"), false);
    assert.equal(dataValida("24/11/2026"), false);
  });
});
