// A página: estado, desenho na tela e eventos. Fala com a API só por ./api.
import {
  atualizarTarefa,
  buscarEstatisticas,
  buscarEu,
  criarConta,
  criarTarefa,
  encerrarSessao,
  entrar,
  guardarSessao,
  listarTarefas,
  removerTarefa,
  sessaoAtual,
} from "./api";
import {
  contarPorStatus,
  estaAtrasada,
  existeAltaPendente,
  filtrarPorStatus,
  formatarPrazo,
  hojeIso,
  ordenarPorPrioridade,
  pesquisar,
  proximoStatus,
  rotuloPrioridade,
  rotuloStatus,
  tarefasParaCsv,
  todasConcluidas,
} from "./servicos";
import type { Contagem, NovaTarefa, Prioridade, Status, Tarefa } from "./tipos";

// ---------- Ajudantes para achar elementos (erro claro se o id estiver errado) ----------
function elemento(id: string): HTMLElement {
  const encontrado = document.getElementById(id);
  if (!encontrado) {
    throw new Error(`Não existe nenhum elemento com o id "${id}".`);
  }
  return encontrado;
}

function campo<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement = HTMLInputElement>(
  id: string
): T {
  return elemento(id) as T;
}

function criar<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe: string,
  texto?: string
): HTMLElementTagNameMap[K] {
  const novo = document.createElement(tag);
  novo.className = classe;
  if (texto !== undefined) novo.textContent = texto; // textContent: nunca interpreta HTML
  return novo;
}

// ---------- Estado ----------
let lista: Tarefa[] = []; // TODAS as tarefas de quem está logado (carregadas do banco)
let atrasadasDoBanco: Tarefa[] | undefined; // preenchida só quando "Só atrasadas" está ligado
let statusSelecionado: Status | "todos" = "todos";
let termoDeBusca = "";
let soAtrasadas = false;
let editandoId: number | undefined;

// ---------- Erros e avisos ----------
function mostrarErro(erro: unknown): void {
  const mensagem = erro instanceof Error ? erro.message : "Erro inesperado.";
  const aviso = elemento("erro-geral");
  aviso.textContent = mensagem;
  aviso.hidden = false;
}

function limparErro(): void {
  elemento("erro-geral").hidden = true;
}

// Roda uma ação assíncrona: limpa o erro antigo e mostra o novo, se houver.
async function executar(acao: () => Promise<void>): Promise<void> {
  try {
    limparErro();
    await acao();
  } catch (erro) {
    mostrarErro(erro);
  }
}

// ---------- Painel ----------
// O painel existe em DUAS versões, de propósito:
//  - buscarEstatisticas(): o banco conta com GROUP BY. É a versão principal
//    e a melhor quando há muitas tarefas: nada precisa vir para o navegador
//    só para ser contado, e o número é sempre o do banco.
//  - contarPorStatus(): o reduce conta a lista que já está na tela. Não usa
//    rede e é instantâneo; serve como plano B se a rota do painel falhar,
//    e seria suficiente se a lista inteira já estivesse carregada.
async function atualizarPainel(): Promise<void> {
  let contagem: Contagem;
  try {
    contagem = await buscarEstatisticas(); // banco (GROUP BY)
  } catch {
    contagem = contarPorStatus(lista); // navegador (reduce)
  }
  const total = contagem.pendente + contagem.em_andamento + contagem.concluida;
  elemento("total").textContent = String(total);
  elemento("pendentes").textContent = String(contagem.pendente);
  elemento("em-andamento").textContent = String(contagem.em_andamento);
  elemento("concluidas").textContent = String(contagem.concluida);

  // A barra de fluxo: cada trecho tem a largura proporcional ao seu status
  const parte = (n: number): string => (total === 0 ? "0%" : `${(n / total) * 100}%`);
  elemento("fluxo-pendente").style.width = parte(contagem.pendente);
  elemento("fluxo-andamento").style.width = parte(contagem.em_andamento);
  elemento("fluxo-concluida").style.width = parte(contagem.concluida);
  elemento("fluxo").setAttribute(
    "aria-label",
    total === 0
      ? "Sem tarefas ainda"
      : `${contagem.pendente} pendentes, ${contagem.em_andamento} em andamento, ${contagem.concluida} concluídas`
  );
}

// ---------- O cartão de cada tarefa ----------
function criarItem(tarefa: Tarefa): HTMLLIElement {
  const item = criar("li", `cartao cartao--${tarefa.status} cartao--prio-${tarefa.prioridade}`);
  item.append(criar("h3", "cartao__titulo", tarefa.titulo));
  if (tarefa.descricao) {
    item.append(criar("p", "cartao__descricao", tarefa.descricao));
  }

  const meta = criar("div", "cartao__meta");
  const etiqueta = criar("span", `etiqueta etiqueta--${tarefa.prioridade}`, rotuloPrioridade[tarefa.prioridade]);
  const situacao = criar("span", "situacao", rotuloStatus[tarefa.status]);
  meta.append(etiqueta, situacao);

  if (tarefa.prazo) {
    const atrasada = estaAtrasada(tarefa);
    const prazo = criar(
      "span",
      atrasada ? "prazo prazo--atrasado" : "prazo",
      `${atrasada ? "Atrasada · " : "Prazo: "}${formatarPrazo(tarefa.prazo)}`
    );
    meta.append(prazo);
  }
  // as tags: cada uma vira um <span>
  meta.append(...tarefa.tags.map((tag) => criar("span", "tag", tag)));

  const acoes = criar("div", "cartao__acoes");
  const rotuloAvancar: Record<Status, string> = {
    pendente: "Iniciar",
    em_andamento: "Concluir",
    concluida: "Reabrir",
  };
  const avancar = criar("button", "botao botao--pequeno", rotuloAvancar[tarefa.status]);
  avancar.type = "button";
  avancar.addEventListener("click", () => {
    void executar(async () => {
      await atualizarTarefa(tarefa.id, { status: proximoStatus[tarefa.status] });
      await recarregar();
    });
  });

  const editar = criar("button", "botao botao--pequeno", "Editar");
  editar.type = "button";
  editar.addEventListener("click", () => preencherFormulario(tarefa));

  const remover = criar("button", "botao botao--pequeno botao--perigo", "Remover");
  remover.type = "button";
  remover.addEventListener("click", () => {
    if (!confirm(`Remover a tarefa "${tarefa.titulo}"?`)) return;
    void executar(async () => {
      await removerTarefa(tarefa.id);
      if (editandoId === tarefa.id) limparFormulario();
      await recarregar();
    });
  });

  acoes.append(avancar, editar, remover);
  item.append(meta, acoes);
  return item;
}

// ---------- Desenhar a lista ----------
// Quais tarefas mostrar: (do banco ou da lista) → filtrar → pesquisar → ordenar.
// O filtro muda o que é MOSTRADO, nunca a lista que existe.
function tarefasVisiveis(): Tarefa[] {
  let resultado = soAtrasadas ? (atrasadasDoBanco ?? []) : lista;
  if (statusSelecionado !== "todos") {
    resultado = filtrarPorStatus(resultado, statusSelecionado);
  }
  if (termoDeBusca.trim() !== "") {
    resultado = pesquisar(resultado, termoDeBusca);
  }
  return ordenarPorPrioridade(resultado);
}

function desenhar(): void {
  const visiveis = tarefasVisiveis();
  elemento("lista").replaceChildren(...visiveis.map(criarItem));
  elemento("vazio").hidden = visiveis.length > 0;

  // some: existe pelo menos uma urgente pendente?
  elemento("aviso-urgente").classList.toggle("aviso--oculto", !existeAltaPendente(lista));
  // every: todas concluídas?
  elemento("aviso-ok").classList.toggle("aviso--oculto", !todasConcluidas(lista));
}

// Busca de novo no banco (depois de criar, editar ou remover) e redesenha.
async function recarregar(): Promise<void> {
  lista = await listarTarefas();
  atrasadasDoBanco = soAtrasadas ? await listarTarefas({ atrasadas: true }) : undefined;
  desenhar();
  await atualizarPainel();
}

// ---------- O formulário (criar e editar) ----------
function lerFormulario(): NovaTarefa {
  return {
    titulo: campo("tarefa-titulo").value.trim(),
    descricao: campo<HTMLTextAreaElement>("tarefa-descricao").value.trim(),
    prioridade: campo<HTMLSelectElement>("tarefa-prioridade").value as Prioridade,
    status: campo<HTMLSelectElement>("tarefa-status").value as Status,
    prazo: campo("tarefa-prazo").value,
    tags: campo("tarefa-tags")
      .value.split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== ""),
  };
}

function limparFormulario(): void {
  (elemento("form-tarefa") as HTMLFormElement).reset();
  editandoId = undefined;
  elemento("titulo-formulario").textContent = "Nova tarefa";
  elemento("botao-salvar").textContent = "Adicionar tarefa";
  elemento("botao-cancelar").hidden = true;
  elemento("erro-formulario").textContent = "";
}

function preencherFormulario(tarefa: Tarefa): void {
  editandoId = tarefa.id;
  campo("tarefa-titulo").value = tarefa.titulo;
  campo<HTMLTextAreaElement>("tarefa-descricao").value = tarefa.descricao ?? "";
  campo<HTMLSelectElement>("tarefa-prioridade").value = tarefa.prioridade;
  campo<HTMLSelectElement>("tarefa-status").value = tarefa.status;
  campo("tarefa-prazo").value = tarefa.prazo ?? "";
  campo("tarefa-tags").value = tarefa.tags.join(", ");
  elemento("titulo-formulario").textContent = "Editar tarefa";
  elemento("botao-salvar").textContent = "Salvar alterações";
  elemento("botao-cancelar").hidden = false;
  elemento("erro-formulario").textContent = "";
  elemento("form-tarefa").scrollIntoView({ behavior: "smooth", block: "center" });
  campo("tarefa-titulo").focus();
}

elemento("form-tarefa").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const dados = lerFormulario();
  if (dados.titulo === "") {
    elemento("erro-formulario").textContent = "Dê um título à tarefa.";
    return;
  }
  elemento("erro-formulario").textContent = "";
  void executar(async () => {
    if (editandoId === undefined) {
      await criarTarefa(dados);
    } else {
      await atualizarTarefa(editandoId, dados);
    }
    limparFormulario();
    await recarregar();
  });
});

elemento("botao-cancelar").addEventListener("click", limparFormulario);

// ---------- Filtros, busca e exportação ----------
// Os botões de filtro: um só "ouvinte" para o grupo inteiro
elemento("filtros-status").addEventListener("click", (evento) => {
  const alvo = evento.target;
  if (!(alvo instanceof HTMLButtonElement)) return;
  const escolhido = alvo.dataset.status;
  if (!escolhido) return;

  statusSelecionado = escolhido as Status | "todos";
  for (const botao of elemento("filtros-status").querySelectorAll("button")) {
    botao.classList.toggle("filtro--ativo", botao === alvo);
  }
  desenhar();
});

// A busca filtra enquanto o usuário digita
campo("busca").addEventListener("input", () => {
  termoDeBusca = campo("busca").value;
  desenhar();
});

// "Só atrasadas" vai ao banco: o WHERE sabe a data de hoje e já devolve só as vencidas
campo("so-atrasadas").addEventListener("change", () => {
  soAtrasadas = campo("so-atrasadas").checked;
  void executar(async () => {
    atrasadasDoBanco = soAtrasadas ? await listarTarefas({ atrasadas: true }) : undefined;
    desenhar();
  });
});

// Exporta o que está na tela (já com filtros, busca e ordem) para um arquivo CSV
elemento("botao-exportar").addEventListener("click", () => {
  const arquivo = new Blob([tarefasParaCsv(tarefasVisiveis())], { type: "text/csv;charset=utf-8" });
  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = endereco;
  link.download = `tarefas-${hojeIso()}.csv`;
  link.click();
  URL.revokeObjectURL(endereco);
});

// ---------- A tela de entrada ----------
function mostrarErroEntrada(erro: unknown): void {
  elemento("erro-entrada").textContent = erro instanceof Error ? erro.message : "Erro inesperado.";
}

// Troca entre "Entrar" e "Criar conta"
function mostrarFormulario(criando: boolean): void {
  elemento("form-criar").hidden = !criando;
  elemento("form-entrar").hidden = criando;
  elemento("alternar-entrada").textContent = criando ? "Já tenho conta" : "Ainda não tenho conta";
  elemento("erro-entrada").textContent = "";
}

elemento("alternar-entrada").addEventListener("click", () => {
  mostrarFormulario(elemento("form-criar").hidden === true); // escondido? então mostra
});

elemento("form-entrar").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  try {
    guardarSessao(await entrar(campo("entrar-email").value, campo("entrar-senha").value));
    campo("entrar-senha").value = "";
    await iniciar();
  } catch (erro) {
    mostrarErroEntrada(erro);
  }
});

elemento("form-criar").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const email = campo("criar-email").value;
  const senha = campo("criar-senha").value;
  try {
    await criarConta(campo("criar-nome").value, email, senha);
    guardarSessao(await entrar(email, senha)); // criou? já entra direto
    (elemento("form-criar") as HTMLFormElement).reset(); // não deixa a senha no campo
    await iniciar();
  } catch (erro) {
    mostrarErroEntrada(erro);
  }
});

elemento("botao-sair").addEventListener("click", () => {
  encerrarSessao();
  // zera tudo o que era da pessoa que saiu
  lista = [];
  atrasadasDoBanco = undefined;
  statusSelecionado = "todos";
  termoDeBusca = "";
  soAtrasadas = false;
  campo("busca").value = "";
  campo("so-atrasadas").checked = false;
  for (const botao of elemento("filtros-status").querySelectorAll("button")) {
    botao.classList.toggle("filtro--ativo", botao.dataset.status === "todos");
  }
  limparFormulario();
  limparErro();
  (elemento("form-entrar") as HTMLFormElement).reset();
  mostrarFormulario(false); // volta sempre para "Entrar"
  void iniciar();
});

// ---------- O começo: com sessão, mostra o sistema; sem, a entrada ----------
async function iniciar(): Promise<void> {
  const sessao = sessaoAtual();
  elemento("tela-entrada").hidden = sessao !== undefined;
  elemento("tela-app").hidden = sessao === undefined;
  elemento("botao-sair").hidden = sessao === undefined;
  elemento("usuario-nome").textContent = sessao?.nome ?? "";
  elemento("avatar").hidden = sessao === undefined;
  elemento("avatar").textContent = (sessao?.nome ?? "").trim().charAt(0).toUpperCase();
  if (!sessao) {
    return;
  }
  elemento("erro-entrada").textContent = "";
  await executar(async () => {
    const eu = await buscarEu(); // o nome vem do servidor, não só da sessão guardada
    elemento("usuario-nome").textContent = eu.nome;
    elemento("avatar").textContent = eu.nome.trim().charAt(0).toUpperCase();
    await recarregar();
  });
}

void iniciar();
