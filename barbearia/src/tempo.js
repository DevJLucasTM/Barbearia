/**
 * Funções de data e hora.
 *
 * Por que não usar Date direto em tudo? Porque o servidor pode estar rodando
 * em outro fuso (um servidor nos EUA, por exemplo) e aí "agora" lá não é
 * "agora" em Quixadá. Então a gente sempre pergunta a hora NO FUSO da barbearia.
 *
 * Internamente, hora do dia é guardada como MINUTOS desde meia-noite
 * (09:30 = 570). Fica muito mais fácil somar duração e comparar horários.
 */

/** "09:30" -> 570 */
function paraMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30" */
function paraHora(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** Data e minutos de "agora" no fuso informado. */
function agoraNoFuso(dataJs, fuso) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: fuso,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(dataJs).map((p) => [p.type, p.value])
  );
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

/** "2026-11-10" -> 2 (terça). Usa meio-dia UTC pra fugir de problema de fuso. */
function diaDaSemana(data) {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

function somarDias(data, dias) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Checa formato E se a data existe (31/02 não passa). */
function dataValida(data) {
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  return new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) === data;
}

function horaValida(hora) {
  return typeof hora === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

module.exports = { paraMinutos, paraHora, agoraNoFuso, diaDaSemana, somarDias, dataValida, horaValida };
