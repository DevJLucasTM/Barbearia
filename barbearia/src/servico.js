/**
 * Regras de negócio do agendamento.
 *
 * Ele não sabe que existe Express nem HTTP: recebe dados, valida, decide e
 * devolve resultado (ou lança ErroDeNegocio). Quem transforma isso em
 * resposta HTTP é o app.js.
 */
const crypto = require("node:crypto");
const { horariosLivres } = require("./agenda");
const t = require("./tempo");

class ErroDeNegocio extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Sem 0/O, 1/I/L: ninguém confunde ao ditar o código por telefone
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function gerarCodigo() {
  let codigo = "";
  for (let i = 0; i < 6; i++) codigo += ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)];
  return codigo;
}

function criarServicoAgendamento({ repo, config, relogio = () => new Date() }) {
  const agora = () => t.agoraNoFuso(relogio(), config.fusoHorario);

  const servicoPorId = (id) => {
    const s = config.servicos.find((x) => x.id === id);
    if (!s) throw new ErroDeNegocio(400, "Serviço não encontrado");
    return s;
  };

  // "qualquer" = sem preferência de barbeiro, então vale qualquer um
  const barbeirosPorId = (id) => {
    if (!id || id === "qualquer") return config.barbeiros;
    const b = config.barbeiros.find((x) => x.id === id);
    if (!b) throw new ErroDeNegocio(400, "Barbeiro não encontrado");
    return [b];
  };

  function validarData(data) {
    if (!t.dataValida(data)) throw new ErroDeNegocio(400, "Data inválida. Use o formato AAAA-MM-DD");
    const hoje = agora().data;
    if (data < hoje) throw new ErroDeNegocio(400, "Essa data já passou");
    if (data > t.somarDias(hoje, config.diasDeAntecedenciaMaxima))
      throw new ErroDeNegocio(400, `Só dá pra marcar com até ${config.diasDeAntecedenciaMaxima} dias de antecedência`);
  }

  /** Horários livres de UM barbeiro, em minutos. */
  function livresDoBarbeiro(barbeiroId, data, duracao) {
    const { data: hoje, minutos } = agora();
    return horariosLivres({
      periodos: config.funcionamento[t.diaDaSemana(data)],
      duracao,
      intervalo: config.intervalo,
      ocupados: repo.ocupados(barbeiroId, data),
      aPartirDe: data === hoje ? minutos : -1,
    });
  }

  /**
   * Horários disponíveis. Com barbeiro "qualquer", junta os horários de todo mundo
   * e diz quais barbeiros estão livres em cada um.
   */
  function listarHorarios({ data, servicoId, barbeiroId }) {
    validarData(data);
    const servico = servicoPorId(servicoId);
    const mapa = new Map(); // minutos -> [ids dos barbeiros livres]

    for (const b of barbeirosPorId(barbeiroId)) {
      for (const inicio of livresDoBarbeiro(b.id, data, servico.duracao)) {
        if (!mapa.has(inicio)) mapa.set(inicio, []);
        mapa.get(inicio).push(b.id);
      }
    }

    return [...mapa.entries()]
      .sort(([a], [b]) => a - b)
      .map(([inicio, barbeiros]) => ({ hora: t.paraHora(inicio), barbeiros }));
  }

  function agendar({ nome, telefone, servicoId, barbeiroId, data, hora }) {
    nome = String(nome ?? "").trim();
    telefone = String(telefone ?? "").replace(/\D/g, ""); // (88) 99999-0000 -> 88999990000
    if (nome.length < 2) throw new ErroDeNegocio(400, "Informe seu nome");
    if (nome.length > 80) throw new ErroDeNegocio(400, "Nome muito comprido");
    if (telefone.length < 10 || telefone.length > 11) throw new ErroDeNegocio(400, "Telefone inválido. Use DDD + número");
    if (!t.horaValida(hora)) throw new ErroDeNegocio(400, "Horário inválido");
    validarData(data);
    const servico = servicoPorId(servicoId);
    const candidatos = barbeirosPorId(barbeiroId);

    if (repo.contarAtivosDoTelefone(telefone, agora()) >= config.maxAgendamentosAtivosPorCliente)
      throw new ErroDeNegocio(409, `Você já tem ${config.maxAgendamentosAtivosPorCliente} horários marcados. Cancele um pra marcar outro`);

    const inicio = t.paraMinutos(hora);

    // Tenta cada barbeiro candidato até um aceitar
    for (const barbeiro of candidatos) {
      // Checa se esse horário é um horário que a gente OFERECE (dentro do expediente,
      // não passou, encaixa no intervalo). Não dá pra confiar só no front-end.
      if (!livresDoBarbeiro(barbeiro.id, data, servico.duracao).includes(inicio)) continue;

      const salvo = repo.inserirSeLivre({
        codigo: gerarCodigo(),
        clienteNome: nome,
        clienteTelefone: telefone,
        servicoId: servico.id,
        barbeiroId: barbeiro.id,
        data,
        inicio,
        fim: inicio + servico.duracao,
        preco: servico.preco,
        criadoEm: relogio().toISOString(),
      });
      if (salvo) return detalhar(salvo);
    }
    throw new ErroDeNegocio(409, "Esse horário acabou de ser ocupado. Escolhe outro?");
  }

  function consultar(codigo) {
    const a = repo.buscarPorCodigo(String(codigo ?? "").trim().toUpperCase());
    if (!a) throw new ErroDeNegocio(404, "Nenhum agendamento com esse código");
    return detalhar(a);
  }

  function cancelar(codigo) {
    const a = consultar(codigo);
    if (a.status === "cancelado") throw new ErroDeNegocio(409, "Esse agendamento já foi cancelado");

    // Quantos minutos faltam pro horário (funciona até virando o dia:
    // 23h de hoje pra 8h de amanhã dá 540 minutos)
    const { data: hoje, minutos } = agora();
    const diasAteLa = (Date.parse(a.data) - Date.parse(hoje)) / 86_400_000;
    const faltam = diasAteLa * 1440 + t.paraMinutos(a.hora) - minutos;

    if (faltam <= 0) throw new ErroDeNegocio(409, "Esse horário já passou");
    if (faltam < config.minutosMinimosParaCancelar)
      throw new ErroDeNegocio(409,
        `Cancelamento só até ${config.minutosMinimosParaCancelar / 60}h antes. Liga pra barbearia, por favor`);

    repo.cancelar(a.codigo, relogio().toISOString());
    return consultar(a.codigo);
  }

  /** Agenda do dia pro painel do barbeiro, com faturamento previsto. */
  function agendaDoDia(data) {
    if (!t.dataValida(data)) throw new ErroDeNegocio(400, "Data inválida");
    const itens = repo.doDia(data).map(detalhar);
    const confirmados = itens.filter((a) => a.status === "confirmado");
    return {
      data,
      itens,
      resumo: {
        confirmados: confirmados.length,
        cancelados: itens.length - confirmados.length,
        faturamentoPrevisto: confirmados.reduce((soma, a) => soma + a.preco, 0),
      },
    };
  }

  /** Transforma o registro do banco em algo amigável pra mostrar na tela. */
  function detalhar(a) {
    const servico = config.servicos.find((s) => s.id === a.servicoId);
    const barbeiro = config.barbeiros.find((b) => b.id === a.barbeiroId);
    return {
      codigo: a.codigo,
      status: a.status,
      clienteNome: a.clienteNome,
      clienteTelefone: a.clienteTelefone,
      servico: { id: a.servicoId, nome: servico?.nome ?? a.servicoId },
      barbeiro: { id: a.barbeiroId, nome: barbeiro?.nome ?? a.barbeiroId },
      data: a.data,
      hora: t.paraHora(a.inicio),
      horaFim: t.paraHora(a.fim),
      preco: a.preco,
    };
  }

  /** O que o front precisa saber pra montar a tela. */
  function informacoes() {
    return {
      nome: config.nome,
      hoje: agora().data,
      diasDeAntecedenciaMaxima: config.diasDeAntecedenciaMaxima,
      funcionamento: config.funcionamento,
      servicos: config.servicos,
      barbeiros: config.barbeiros,
    };
  }

  return { listarHorarios, agendar, consultar, cancelar, agendaDoDia, informacoes };
}

module.exports = { criarServicoAgendamento, ErroDeNegocio };
