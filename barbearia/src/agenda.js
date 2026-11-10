/**
 * O coração do sistema: descobrir quais horários estão livres.
 *
 * São funções "puras": recebem tudo que precisam por parâmetro e não mexem
 * em banco nem em nada externo. Isso deixa elas fáceis de entender e de testar.
 */
const { paraMinutos } = require("./tempo");

/**
 * Dois intervalos [inicio, fim) se sobrepõem se um começa antes do outro terminar.
 * Repara que encostar não conta: um corte das 9:00 às 9:30 e outro das 9:30 às 10:00
 * não batem.
 */
function sobrepoe(a, b) {
  return a.inicio < b.fim && b.inicio < a.fim;
}

/**
 * Gera os horários de início possíveis pra um serviço num dia.
 *
 * @param periodos  ex: [["09:00","12:00"], ["13:00","19:00"]] (ou null se fechado)
 * @param duracao   duração do serviço em minutos
 * @param intervalo de quanto em quanto tempo oferecer horário
 * @param ocupados  lista de { inicio, fim } em minutos que já estão marcados
 * @param aPartirDe minutos a partir dos quais pode marcar (pra não oferecer horário que já passou)
 * @returns lista de inícios em minutos, ex: [540, 570, 600]
 */
function horariosLivres({ periodos, duracao, intervalo, ocupados = [], aPartirDe = -1 }) {
  if (!periodos) return [];
  const livres = [];

  for (const [abre, fecha] of periodos) {
    const inicioPeriodo = paraMinutos(abre);
    const fimPeriodo = paraMinutos(fecha);

    // O serviço tem que CABER inteiro no período: um combo de 60 min às 11:30
    // atravessaria o almoço, então não aparece
    for (let inicio = inicioPeriodo; inicio + duracao <= fimPeriodo; inicio += intervalo) {
      if (inicio <= aPartirDe) continue;
      const candidato = { inicio, fim: inicio + duracao };
      if (!ocupados.some((o) => sobrepoe(candidato, o))) livres.push(inicio);
    }
  }
  return livres;
}

module.exports = { sobrepoe, horariosLivres };
