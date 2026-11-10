/**
 * Consultar e cancelar um agendamento pelo código.
 * Aceita o código direto na URL: agendamento.html?codigo=K7P2QM
 */

const $ = (id) => document.getElementById(id);

// Atalhos pros códigos que este navegador já reservou
const salvos = codigosSalvos.listar();
if (salvos.length) {
  $("salvos").replaceChildren(
    el("small", { style: "color: var(--texto-suave); width: 100%" }, "Seus últimos códigos neste aparelho:"),
    ...salvos.map((c) => el("a", { href: `?codigo=${c}` }, c))
  );
}

$("form-busca").addEventListener("submit", (e) => {
  e.preventDefault();
  buscar($("codigo").value);
});

const doEndereco = new URLSearchParams(location.search).get("codigo");
if (doEndereco) {
  $("codigo").value = doEndereco;
  buscar(doEndereco);
}

async function buscar(codigo) {
  $("erro").textContent = "";
  $("detalhes").hidden = true;
  try {
    mostrar(await api(`/api/agendamentos/${encodeURIComponent(codigo.trim())}`));
  } catch (e) {
    $("erro").textContent = e.message;
  }
}

function mostrar(a) {
  const linhas = [
    ["Código", a.codigo],
    ["Serviço", `${a.servico.nome} · ${moeda(a.preco)}`],
    ["Profissional", a.barbeiro.nome],
    ["Quando", `${dataPorExtenso(a.data)}, das ${a.hora} às ${a.horaFim}`],
    ["Nome", a.clienteNome],
  ];

  const conteudo = [
    el("span", { className: `selo ${a.status}` }, a.status),
    el("h2", { style: "margin-top: 10px" }, `${a.servico.nome} com ${a.barbeiro.nome}`),
    el("div", { className: "resumo", style: "margin-top: 14px" },
      el("dl", {}, ...linhas.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)]))),
  ];

  if (a.status === "confirmado") {
    const cancelar = el("button", { type: "button", className: "botao perigo" }, "Cancelar agendamento");
    cancelar.addEventListener("click", async () => {
      if (!confirm("Tem certeza? O horário vai ficar livre pra outra pessoa.")) return;
      cancelar.disabled = true;
      try {
        mostrar(await api(`/api/agendamentos/${a.codigo}`, { method: "DELETE" }));
      } catch (e) {
        $("erro").textContent = e.message;
        cancelar.disabled = false;
      }
    });
    conteudo.push(el("div", { className: "acoes", style: "justify-content: flex-start" }, cancelar));
  } else {
    conteudo.push(el("div", { className: "acoes", style: "justify-content: flex-start" },
      el("a", { className: "botao", href: "/" }, "Marcar outro horário")));
  }

  $("detalhes").replaceChildren(...conteudo);
  $("detalhes").hidden = false;
}
