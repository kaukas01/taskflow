// As consultas e regras que rodam no NAVEGADOR, sobre a lista já carregada.
// Funções puras: recebem dados, devolvem dados, não mexem na tela.
import type { Contagem, Prioridade, Status, Tarefa } from "./tipos";

// ---------- textos para a tela ----------
export const rotuloStatus: Record<Status, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export const rotuloPrioridade: Record<Prioridade, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// Para onde o botão de ação leva a tarefa: pendente → em andamento → concluída → pendente
export const proximoStatus: Record<Status, Status> = {
  pendente: "em_andamento",
  em_andamento: "concluida",
  concluida: "pendente",
};

// "2026-11-15" → "15/11/2026" (sem passar por Date: evita erro de fuso)
export function formatarPrazo(prazo: string): string {
  const [ano, mes, dia] = prazo.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ---------- filter: selecionar ----------
export function filtrarPorStatus(lista: Tarefa[], status: Status): Tarefa[] {
  return lista.filter((t) => t.status === status);
}

// Pesquisa sem diferenciar maiúsculas de minúsculas, no título e nas tags
export function pesquisar(lista: Tarefa[], termo: string): Tarefa[] {
  const procurado = termo.trim().toLowerCase();
  return lista.filter(
    (t) =>
      t.titulo.toLowerCase().includes(procurado) ||
      t.tags.some((tag) => tag.toLowerCase().includes(procurado))
  );
}

// ---------- some e every: perguntas de sim ou não ----------
export function existeAltaPendente(lista: Tarefa[]): boolean {
  return lista.some((t) => t.prioridade === "alta" && t.status === "pendente");
}

export function todasConcluidas(lista: Tarefa[]): boolean {
  return lista.length > 0 && lista.every((t) => t.status === "concluida");
}

// ---------- reduce: o painel calculado no navegador ----------
export function contarPorStatus(lista: Tarefa[]): Contagem {
  return lista.reduce<Contagem>(
    (acumulador, t) => {
      acumulador[t.status]++;
      return acumulador; // não esqueça este return!
    },
    { pendente: 0, em_andamento: 0, concluida: 0 }
  );
}

// ---------- sort: ordenar sem estragar o original ----------
const pesoPrioridade: Record<Prioridade, number> = { alta: 3, media: 2, baixa: 1 };

export function ordenarPorPrioridade(lista: Tarefa[]): Tarefa[] {
  return [...lista].sort(
    (a, b) =>
      pesoPrioridade[b.prioridade] - pesoPrioridade[a.prioridade] ||
      a.titulo.localeCompare(b.titulo, "pt-BR")
  );
}

// ---------- prazo ----------
// A data de hoje do computador, no formato do banco ("AAAA-MM-DD")
export function hojeIso(agora: Date = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

// Atrasada: tem prazo vencido e ainda não foi concluída.
// Datas no formato AAAA-MM-DD se comparam como texto.
export function estaAtrasada(tarefa: Tarefa, hoje: string = hojeIso()): boolean {
  return tarefa.prazo !== undefined && tarefa.status !== "concluida" && tarefa.prazo < hoje;
}

// ---------- exportar para CSV (recurso próprio do grupo) ----------
// Aspas duplicadas protegem vírgulas e quebras de linha. Valor que começaria
// com = + - @ ganha um apóstrofo: o Excel não o executa como fórmula.
function celulaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replace(/"/g, '""')}"`;
}

// Separador ";" e BOM no início: o Excel em português abre com colunas e acentos certos.
export function tarefasParaCsv(lista: Tarefa[]): string {
  const cabecalho = ["Título", "Descrição", "Prioridade", "Status", "Prazo", "Tags"];
  const linhas = lista.map((t) => [
    t.titulo,
    t.descricao ?? "",
    rotuloPrioridade[t.prioridade],
    rotuloStatus[t.status],
    t.prazo ? formatarPrazo(t.prazo) : "",
    t.tags.join(", "),
  ]);
  const texto = [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n");
  return `﻿${texto}`;
}
