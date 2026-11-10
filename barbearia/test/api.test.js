/**
 * Testa a API de ponta a ponta: sobe o servidor de verdade numa porta
 * aleatória, com banco em memória e um relógio que a gente controla.
 */
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const config = require("../src/config");
const { criarRepositorio } = require("../src/repositorio");
const { criarServicoAgendamento } = require("../src/servico");
const { criarApp } = require("../src/app");

// Terça, 10/11/2026, 10:00 em Fortaleza (13:00 UTC)
let agora;
const relogio = () => agora;
let servidor, base, repo;

before(async () => {
  repo = criarRepositorio(":memory:");
  const servico = criarServicoAgendamento({ repo, config, relogio });
  const app = criarApp({ servico, senhaAdmin: "segredo" });
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}`;
});

after(() => { servidor.close(); repo.fechar(); });

beforeEach(() => { agora = new Date("2026-11-10T13:00:00Z"); });

async function api(metodo, rota, corpo, headers = {}) {
  const r = await fetch(base + rota, {
    method: metodo,
    headers: { "content-type": "application/json", ...headers },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, corpo: await r.json() };
}

let telefoneSeq = 0;
const novoTelefone = () => `8899900${String(++telefoneSeq).padStart(4, "0")}`;

const reservar = (extra = {}) => api("POST", "/api/agendamentos", {
  nome: "Lucas", telefone: novoTelefone(), servicoId: "corte", barbeiroId: "joao",
  data: "2026-11-12", hora: "10:00", ...extra,
});

test("informações básicas", async () => {
  const { status, corpo } = await api("GET", "/api/informacoes");
  assert.equal(status, 200);
  assert.equal(corpo.hoje, "2026-11-10");
  assert.ok(corpo.servicos.length > 0);
});

test("hoje não mostra horários que já passaram", async () => {
  const { corpo } = await api("GET", "/api/horarios?data=2026-11-10&servicoId=corte&barbeiroId=joao");
  assert.equal(corpo[0].hora, "10:30");
});

test("domingo é fechado", async () => {
  const { corpo } = await api("GET", "/api/horarios?data=2026-11-15&servicoId=corte&barbeiroId=joao");
  assert.deepEqual(corpo, []);
});

test("reserva, horário some da lista e consulta pelo código", async () => {
  const { status, corpo } = await reservar({ hora: "15:00", telefone: "(88) 99999-0000" });
  assert.equal(status, 201);
  assert.match(corpo.codigo, /^[A-Z2-9]{6}$/);
  assert.equal(corpo.clienteTelefone, "88999990000");
  assert.equal(corpo.horaFim, "15:30");

  const horarios = await api("GET", "/api/horarios?data=2026-11-12&servicoId=corte&barbeiroId=joao");
  assert.ok(!horarios.corpo.some((x) => x.hora === "15:00"));

  const consulta = await api("GET", `/api/agendamentos/${corpo.codigo.toLowerCase()}`);
  assert.equal(consulta.corpo.servico.nome, "Corte");
});

test("dois clientes no mesmo horário: o segundo leva 409", async () => {
  assert.equal((await reservar({ hora: "16:00" })).status, 201);
  const segundo = await reservar({ hora: "16:00" });
  assert.equal(segundo.status, 409);
});

test("serviço longo bloqueia os horários que ele cobre", async () => {
  await reservar({ barbeiroId: "rafa", servicoId: "pigmentacao", hora: "14:00" }); // 14:00-15:30
  const r = await reservar({ barbeiroId: "rafa", hora: "15:00" });
  assert.equal(r.status, 409);
  assert.equal((await reservar({ barbeiroId: "rafa", hora: "15:30" })).status, 201);
});

test("sem preferência de barbeiro: escolhe quem estiver livre", async () => {
  const dia = "2026-11-13";
  await reservar({ data: dia, hora: "09:00", barbeiroId: "joao" });
  await reservar({ data: dia, hora: "09:00", barbeiroId: "rafa" });

  const horarios = await api("GET", `/api/horarios?data=${dia}&servicoId=corte&barbeiroId=qualquer`);
  assert.deepEqual(horarios.corpo.find((x) => x.hora === "09:00").barbeiros, ["duda"]);

  const r = await reservar({ data: dia, hora: "09:00", barbeiroId: "qualquer" });
  assert.equal(r.corpo.barbeiro.id, "duda");
  assert.equal((await reservar({ data: dia, hora: "09:00", barbeiroId: "qualquer" })).status, 409);
});

test("horário fora do expediente ou quebrado é recusado", async () => {
  assert.equal((await reservar({ hora: "12:00" })).status, 409); // almoço
  assert.equal((await reservar({ hora: "10:15" })).status, 409); // fora da grade de 30 em 30
  assert.equal((await reservar({ hora: "07:00" })).status, 409); // antes de abrir
});

test("validações de entrada", async () => {
  assert.equal((await reservar({ nome: "" })).status, 400);
  assert.equal((await reservar({ telefone: "123" })).status, 400);
  assert.equal((await reservar({ data: "2026-11-09" })).status, 400); // ontem
  assert.equal((await reservar({ data: "2027-03-01" })).status, 400); // longe demais
  assert.equal((await reservar({ servicoId: "massagem" })).status, 400);
  assert.equal((await reservar({ hora: "25:00" })).status, 400);
});

test("limite de agendamentos ativos por telefone", async () => {
  const telefone = "88911112222";
  await reservar({ telefone, data: "2026-11-17", hora: "09:00" });
  await reservar({ telefone, data: "2026-11-17", hora: "10:00" });
  const terceiro = await reservar({ telefone, data: "2026-11-17", hora: "11:00" });
  assert.equal(terceiro.status, 409);
});

test("cancelar libera o horário de novo", async () => {
  const { corpo } = await reservar({ data: "2026-11-18", hora: "09:00" });
  const cancelado = await api("DELETE", `/api/agendamentos/${corpo.codigo}`);
  assert.equal(cancelado.corpo.status, "cancelado");

  const horarios = await api("GET", "/api/horarios?data=2026-11-18&servicoId=corte&barbeiroId=joao");
  assert.ok(horarios.corpo.some((x) => x.hora === "09:00"));
  assert.equal((await api("DELETE", `/api/agendamentos/${corpo.codigo}`)).status, 409); // de novo não
});

test("não cancela com menos de 2h de antecedência, nem virando o dia", async () => {
  const hoje = await reservar({ data: "2026-11-10", hora: "11:30" }); // agora são 10:00
  assert.equal((await api("DELETE", `/api/agendamentos/${hoje.corpo.codigo}`)).status, 409);

  const amanhaCedo = await reservar({ data: "2026-11-11", hora: "09:00" });
  agora = new Date("2026-11-11T11:00:00Z"); // 08:00 em Fortaleza
  assert.equal((await api("DELETE", `/api/agendamentos/${amanhaCedo.corpo.codigo}`)).status, 409);
});

test("código inexistente dá 404", async () => {
  assert.equal((await api("GET", "/api/agendamentos/ZZZZZZ")).status, 404);
});

test("painel exige senha e mostra o resumo do dia", async () => {
  assert.equal((await api("GET", "/api/admin/agenda?data=2026-11-12")).status, 401);
  assert.equal((await api("GET", "/api/admin/agenda?data=2026-11-12", null, { "x-admin-senha": "errada" })).status, 401);

  const { status, corpo } = await api("GET", "/api/admin/agenda?data=2026-11-12", null, { "x-admin-senha": "segredo" });
  assert.equal(status, 200);
  assert.ok(corpo.itens.length >= 4);
  assert.equal(corpo.resumo.faturamentoPrevisto,
    corpo.itens.filter((a) => a.status === "confirmado").reduce((s, a) => s + a.preco, 0));
});

test("JSON quebrado e rota inexistente", async () => {
  const r = await fetch(base + "/api/agendamentos", { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
  assert.equal(r.status, 400);
  assert.equal((await api("GET", "/api/nada")).status, 404);
});
