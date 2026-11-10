const { test } = require("node:test");
const assert = require("node:assert/strict");
const { horariosLivres, sobrepoe } = require("../src/agenda");
const t = require("../src/tempo");

const manha = [["09:00", "12:00"]];
const h = (lista) => lista.map(t.paraHora); // deixa os asserts legíveis

test("dia fechado não tem horário", () => {
  assert.deepEqual(horariosLivres({ periodos: null, duracao: 30, intervalo: 30 }), []);
});

test("gera horários de 30 em 30 dentro do período", () => {
  const livres = horariosLivres({ periodos: manha, duracao: 30, intervalo: 30 });
  assert.deepEqual(h(livres), ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
});

test("serviço longo precisa caber inteiro antes do fim do período", () => {
  const livres = horariosLivres({ periodos: manha, duracao: 90, intervalo: 30 });
  assert.equal(h(livres).at(-1), "10:30"); // 10:30 + 90min = 12:00 em ponto
});

test("serviço não atravessa o almoço", () => {
  const livres = horariosLivres({ periodos: [["09:00", "12:00"], ["13:00", "14:00"]], duracao: 60, intervalo: 30 });
  assert.deepEqual(h(livres), ["09:00", "09:30", "10:00", "10:30", "11:00", "13:00"]);
});

test("horário ocupado some, e o vizinho que encosta continua livre", () => {
  const ocupados = [{ inicio: t.paraMinutos("10:00"), fim: t.paraMinutos("10:30") }];
  const livres = h(horariosLivres({ periodos: manha, duracao: 30, intervalo: 30, ocupados }));
  assert.ok(!livres.includes("10:00"));
  assert.ok(livres.includes("09:30") && livres.includes("10:30"));
});

test("serviço de 60 min não começa se bater no próximo cliente", () => {
  const ocupados = [{ inicio: t.paraMinutos("10:00"), fim: t.paraMinutos("10:30") }];
  const livres = h(horariosLivres({ periodos: manha, duracao: 60, intervalo: 30, ocupados }));
  assert.ok(!livres.includes("09:30")); // 9:30-10:30 bateria no das 10h
  assert.ok(livres.includes("09:00"));  // 9:00-10:00 encosta, mas não bate
});

test("não oferece horário que já passou", () => {
  const livres = horariosLivres({ periodos: manha, duracao: 30, intervalo: 30, aPartirDe: t.paraMinutos("10:10") });
  assert.equal(h(livres)[0], "10:30");
});

test("sobrepoe", () => {
  assert.equal(sobrepoe({ inicio: 0, fim: 30 }, { inicio: 30, fim: 60 }), false);
  assert.equal(sobrepoe({ inicio: 0, fim: 31 }, { inicio: 30, fim: 60 }), true);
  assert.equal(sobrepoe({ inicio: 10, fim: 20 }, { inicio: 0, fim: 60 }), true);
});

test("utilitários de tempo", () => {
  assert.equal(t.paraMinutos("09:30"), 570);
  assert.equal(t.paraHora(570), "09:30");
  assert.equal(t.diaDaSemana("2026-11-10"), 2); // terça
  assert.equal(t.somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(t.dataValida("2026-02-30"), false);
  assert.equal(t.horaValida("24:00"), false);
  // 15h em UTC = 12h em Fortaleza
  assert.deepEqual(t.agoraNoFuso(new Date("2026-11-10T15:00:00Z"), "America/Fortaleza"), { data: "2026-11-10", minutos: 720 });
});
