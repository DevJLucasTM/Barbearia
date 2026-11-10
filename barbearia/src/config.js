/**
 * Tudo que é "da barbearia" fica aqui: nome, serviços, barbeiros e horários.
 * Quer usar o sistema pra um consultório ou uma quadra? Muda este arquivo e pronto,
 * o resto do código não precisa saber de nada disso.
 */
module.exports = {
  nome: "Barbearia Navalha",
  fusoHorario: "America/Fortaleza",

  // De quanto em quanto tempo aparece um horário na agenda (em minutos)
  intervalo: 30,

  // Regras
  diasDeAntecedenciaMaxima: 30,      // não dá pra marcar pra daqui a 3 meses
  minutosMinimosParaCancelar: 120,   // cancelamento só até 2h antes
  maxAgendamentosAtivosPorCliente: 2,

  // 0 = domingo, 1 = segunda ... 6 = sábado. null = fechado.
  // Cada dia pode ter mais de um período (o buraco no meio é o almoço).
  funcionamento: {
    0: null,
    1: [["09:00", "12:00"], ["13:00", "19:00"]],
    2: [["09:00", "12:00"], ["13:00", "19:00"]],
    3: [["09:00", "12:00"], ["13:00", "19:00"]],
    4: [["09:00", "12:00"], ["13:00", "19:00"]],
    5: [["09:00", "12:00"], ["13:00", "20:00"]],
    6: [["08:00", "14:00"]],
  },

  servicos: [
    { id: "corte", nome: "Corte", duracao: 30, preco: 35 },
    { id: "barba", nome: "Barba", duracao: 30, preco: 25 },
    { id: "combo", nome: "Corte + barba", duracao: 60, preco: 55 },
    { id: "pigmentacao", nome: "Pigmentação", duracao: 90, preco: 80 },
  ],

  barbeiros: [
    { id: "joao", nome: "João", especialidade: "Degradê e navalhado" },
    { id: "rafa", nome: "Rafa", especialidade: "Barba e pigmentação" },
    { id: "duda", nome: "Duda", especialidade: "Cortes clássicos" },
  ],

  // Senha do painel. Em produção de verdade isso seria login com usuário e senha
  // guardada com hash. Aqui é só pra não deixar a agenda aberta pra qualquer um.
  senhaAdmin: process.env.ADMIN_SENHA || "admin123",
};
