/**
 * Página de agendamento: um passo libera o próximo.
 * Toda escolha fica guardada no objeto "escolha"; a tela é desenhada a partir dele.
 */

const escolha = { servico: null, barbeiro: null, data: null, hora: null };
let info; // dados da barbearia que vêm do servidor

const $ = (id) => document.getElementById(id);
const NOMES_DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

iniciar();

async function iniciar() {
  try {
    info = await api("/api/informacoes");
  } catch (e) {
    $("servicos").replaceChildren(el("p", { className: "aviso" }, e.message));
    return;
  }
  document.title = `Agendar horário | ${info.nome}`;
  $("marca").replaceChildren("✂ ", el("span", {}, info.nome));
  desenharServicos();
  mascararTelefone($("telefone"));
}

// ------------------------------------------------------------- passo 1
function desenharServicos() {
  $("servicos").replaceChildren(...info.servicos.map((s) =>
    botaoOpcao(
      [el("strong", {}, s.nome), el("small", {}, `${s.duracao} min`), el("span", { className: "preco" }, moeda(s.preco))],
      escolha.servico?.id === s.id,
      () => {
        escolha.servico = s;
        escolha.hora = null; // trocou o serviço, a duração muda, então o horário escolhido pode não valer mais
        desenharServicos();
        mostrar("passo-barbeiro");
        desenharBarbeiros();
        if (escolha.data) carregarHorarios();
      }
    )
  ));
}

// ------------------------------------------------------------- passo 2
function desenharBarbeiros() {
  const opcoes = [{ id: "qualquer", nome: "Sem preferência", especialidade: "Quem estiver livre" }, ...info.barbeiros];
  $("barbeiros").replaceChildren(...opcoes.map((b) =>
    botaoOpcao(
      [el("strong", {}, b.nome), el("small", {}, b.especialidade)],
      escolha.barbeiro?.id === b.id,
      () => {
        escolha.barbeiro = b;
        escolha.hora = null;
        desenharBarbeiros();
        mostrar("passo-dia");
        desenharDias();
        if (escolha.data) carregarHorarios();
      }
    )
  ));
}

// ------------------------------------------------------------- passo 3
function desenharDias() {
  const botoes = [];
  for (let i = 0; i <= info.diasDeAntecedenciaMaxima; i++) {
    const d = new Date(`${info.hoje}T12:00:00`);
    d.setDate(d.getDate() + i);
    const data = dataISO(d);
    const fechado = !info.funcionamento[d.getDay()];

    const botao = el("button", { type: "button", className: "dia", disabled: fechado },
      el("span", {}, i === 0 ? "hoje" : NOMES_DIA[d.getDay()]),
      el("strong", {}, String(d.getDate())),
      el("span", {}, d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")));
    botao.setAttribute("aria-pressed", escolha.data === data);
    if (fechado) botao.title = "Fechado";
    botao.addEventListener("click", () => {
      escolha.data = data;
      escolha.hora = null;
      desenharDias();
      mostrar("passo-horario");
      carregarHorarios();
    });
    botoes.push(botao);
  }
  $("dias").replaceChildren(...botoes);
}

// ------------------------------------------------------------- passo 4
let requisicaoAtual = 0; // se o usuário clicar rápido em vários dias, ignora as respostas antigas

async function carregarHorarios() {
  const minha = ++requisicaoAtual;
  $("horarios").replaceChildren(el("p", { className: "aviso" }, "Buscando horários…"));
  esconder("passo-dados");

  try {
    const params = new URLSearchParams({ data: escolha.data, servicoId: escolha.servico.id, barbeiroId: escolha.barbeiro.id });
    const horarios = await api(`/api/horarios?${params}`);
    if (minha !== requisicaoAtual) return;

    if (horarios.length === 0) {
      $("horarios").replaceChildren(el("p", { className: "aviso" }, "Nenhum horário livre nesse dia. Tenta outro? 🙂"));
      return;
    }
    $("horarios").replaceChildren(el("div", { className: "horarios" }, ...horarios.map(({ hora }) => {
      const botao = el("button", { type: "button", className: "horario" }, hora);
      botao.setAttribute("aria-pressed", escolha.hora === hora);
      botao.addEventListener("click", () => {
        escolha.hora = hora;
        $("horarios").querySelectorAll(".horario").forEach((b) => b.setAttribute("aria-pressed", b === botao));
        mostrar("passo-dados");
        desenharResumo();
        $("nome").focus({ preventScroll: true });
      });
      return botao;
    })));
  } catch (e) {
    if (minha === requisicaoAtual) $("horarios").replaceChildren(el("p", { className: "aviso" }, e.message));
  }
}

// ------------------------------------------------------------- passo 5
function desenharResumo() {
  const linhas = [
    ["Serviço", `${escolha.servico.nome} · ${moeda(escolha.servico.preco)}`],
    ["Com", escolha.barbeiro.nome],
    ["Quando", `${dataPorExtenso(escolha.data)} às ${escolha.hora}`],
  ];
  $("resumo").replaceChildren(el("dl", {}, ...linhas.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)])));
  $("erro-reserva").textContent = "";
}

$("form-dados").addEventListener("submit", async (e) => {
  e.preventDefault();
  const botao = $("confirmar");
  botao.disabled = true;
  botao.textContent = "Confirmando…";
  $("erro-reserva").textContent = "";

  try {
    const agendamento = await api("/api/agendamentos", {
      method: "POST",
      corpo: {
        nome: $("nome").value,
        telefone: $("telefone").value,
        servicoId: escolha.servico.id,
        barbeiroId: escolha.barbeiro.id,
        data: escolha.data,
        hora: escolha.hora,
      },
    });
    codigosSalvos.adicionar(agendamento.codigo);
    mostrarSucesso(agendamento);
  } catch (erro) {
    $("erro-reserva").textContent = erro.message;
    // Alguém pegou o horário antes? Atualiza a lista pra pessoa escolher outro
    if (/ocupado/i.test(erro.message)) carregarHorarios();
  } finally {
    botao.disabled = false;
    botao.textContent = "Confirmar agendamento";
  }
});

function mostrarSucesso(a) {
  $("fluxo").hidden = true;
  $("sucesso").hidden = false;
  $("sucesso-texto").textContent =
    `${a.servico.nome} com ${a.barbeiro.nome}, ${dataPorExtenso(a.data)} às ${a.hora}.`;
  $("sucesso-codigo").textContent = a.codigo;
  $("sucesso-link").href = `agendamento.html?codigo=${a.codigo}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ------------------------------------------------------------- auxiliares
function botaoOpcao(conteudo, selecionado, aoClicar) {
  const botao = el("button", { type: "button", className: "opcao" }, ...conteudo);
  botao.setAttribute("aria-pressed", selecionado);
  botao.addEventListener("click", aoClicar);
  return botao;
}

function mostrar(id) {
  const secao = $(id);
  const estavaEscondida = secao.hidden;
  secao.hidden = false;
  if (estavaEscondida) secao.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function esconder(id) {
  $(id).hidden = true;
}
