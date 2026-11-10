/**
 * Funções usadas pelas três páginas.
 */

/** Chama a API e já devolve o JSON. Se der erro, lança com a mensagem do servidor. */
async function api(rota, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(rota, {
      ...opcoes,
      headers: { "content-type": "application/json", ...(opcoes.headers || {}) },
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Ele está rodando?");
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || "Algo deu errado");
  return dados;
}

const moeda = (valor) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "2026-11-12" -> "quinta, 12/11" */
function dataPorExtenso(data, opcoes = { weekday: "long", day: "2-digit", month: "2-digit" }) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", opcoes);
}

/** Máscara de telefone enquanto digita: 88999990000 -> (88) 99999-0000 */
function mascararTelefone(input) {
  input.addEventListener("input", () => {
    const d = input.value.replace(/\D/g, "").slice(0, 11);
    let r = d;
    if (d.length > 2) r = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) r = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    input.value = r;
  });
}

/** Date -> "2026-11-12" usando a data LOCAL (toISOString usaria UTC e poderia mudar o dia) */
function dataISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Cria um elemento rapidinho: el("button", { className: "x" }, "texto") */
function el(tag, props = {}, ...filhos) {
  const elemento = Object.assign(document.createElement(tag), props);
  elemento.append(...filhos);
  return elemento;
}

/** Códigos que este navegador já reservou, pra facilitar achar depois */
const codigosSalvos = {
  listar() {
    try { return JSON.parse(localStorage.getItem("barbearia:codigos")) || []; } catch { return []; }
  },
  adicionar(codigo) {
    const lista = [codigo, ...this.listar().filter((c) => c !== codigo)].slice(0, 5);
    try { localStorage.setItem("barbearia:codigos", JSON.stringify(lista)); } catch { /* sem localStorage, paciência */ }
  },
};
