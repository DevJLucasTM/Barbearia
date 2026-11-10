/**
 * Painel do barbeiro: agenda do dia com resumo.
 * A senha fica só no sessionStorage (some quando fecha a aba).
 */

const $ = (id) => document.getElementById(id);
let senha = sessionStorage.getItem("barbearia:senha");
let hoje;

iniciar();

async function iniciar() {
  hoje = (await api("/api/informacoes").catch(() => ({}))).hoje || dataISO(new Date());
  $("data").value = hoje;
  if (senha) entrar();
}

$("form-login").addEventListener("submit", (e) => {
  e.preventDefault();
  senha = $("senha").value;
  entrar();
});

async function entrar() {
  $("erro-login").textContent = "";
  try {
    await carregar(); // se a senha estiver errada, isso já dá erro
    sessionStorage.setItem("barbearia:senha", senha);
    $("login").hidden = true;
    $("painel").hidden = false;
    $("sair").hidden = false;
  } catch (e) {
    sessionStorage.removeItem("barbearia:senha");
    $("erro-login").textContent = e.message;
  }
}

$("sair").addEventListener("click", (e) => {
  e.preventDefault();
  sessionStorage.removeItem("barbearia:senha");
  location.reload();
});

async function carregar() {
  const data = $("data").value;
  const dia = await api(`/api/admin/agenda?data=${data}`, { headers: { "x-admin-senha": senha } });

  $("titulo-dia").textContent = dataPorExtenso(data, { weekday: "long", day: "numeric", month: "long" });
  $("n-confirmados").textContent = dia.resumo.confirmados;
  $("n-cancelados").textContent = dia.resumo.cancelados;
  $("n-faturamento").textContent = moeda(dia.resumo.faturamentoPrevisto);

  if (dia.itens.length === 0) {
    $("agenda").replaceChildren(el("li", { className: "aviso", style: "display:block" }, "Nenhum agendamento nesse dia."));
    return;
  }

  $("agenda").replaceChildren(...dia.itens.map((a) => {
    const zap = `https://wa.me/55${a.clienteTelefone}`;
    return el("li", { className: a.status },
      el("span", { className: "hora" }, a.hora),
      el("div", { className: "quem" },
        el("strong", {}, a.clienteNome),
        el("small", {}, `${a.servico.nome} · ${a.barbeiro.nome} · até ${a.horaFim}`)),
      el("div", { className: "direita" },
        a.status === "cancelado"
          ? el("span", { className: "selo cancelado" }, "cancelado")
          : el("a", { href: zap, target: "_blank", rel: "noopener" }, formatarTelefone(a.clienteTelefone)),
        el("div", { style: "color: var(--texto-suave)" }, moeda(a.preco))));
  }));
}

function formatarTelefone(t) {
  return t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
}

function mudarDia(delta) {
  const d = new Date(`${$("data").value}T12:00:00`);
  d.setDate(d.getDate() + delta);
  $("data").value = dataISO(d);
  recarregar();
}

async function recarregar() {
  $("erro-painel").textContent = "";
  try { await carregar(); } catch (e) { $("erro-painel").textContent = e.message; }
}

$("anterior").addEventListener("click", () => mudarDia(-1));
$("proximo").addEventListener("click", () => mudarDia(1));
$("hoje").addEventListener("click", () => { $("data").value = hoje; recarregar(); });
$("recarregar").addEventListener("click", recarregar);
$("data").addEventListener("change", recarregar);
