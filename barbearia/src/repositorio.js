/**
 * Tudo que fala com o banco (SQLite) fica aqui. Se um dia quiser trocar por
 * PostgreSQL ou MySQL, é só este arquivo que muda.
 *
 * SQLite é um banco que mora num arquivo só (data/barbearia.db). Não precisa
 * instalar servidor de banco nenhum, perfeito pra projeto pequeno.
 */
const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("node:path");

function criarRepositorio(caminho = ":memory:") {
  if (caminho !== ":memory:") fs.mkdirSync(path.dirname(caminho), { recursive: true });
  const db = new Database(caminho);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo           TEXT    NOT NULL UNIQUE,
      cliente_nome     TEXT    NOT NULL,
      cliente_telefone TEXT    NOT NULL,
      servico_id       TEXT    NOT NULL,
      barbeiro_id      TEXT    NOT NULL,
      data             TEXT    NOT NULL,          -- "2026-11-10"
      inicio           INTEGER NOT NULL,          -- minutos desde meia-noite
      fim              INTEGER NOT NULL,
      preco            REAL    NOT NULL,          -- preço na hora da reserva (se mudar depois, não afeta)
      status           TEXT    NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'cancelado')),
      criado_em        TEXT    NOT NULL,
      cancelado_em     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_barbeiro_data ON agendamentos (barbeiro_id, data);
    CREATE INDEX IF NOT EXISTS idx_telefone ON agendamentos (cliente_telefone);
  `);

  // Prepared statements: o SQL é compilado uma vez só, e os "?" impedem SQL injection
  const sql = {
    ocupados: db.prepare(`
      SELECT inicio, fim FROM agendamentos
      WHERE barbeiro_id = ? AND data = ? AND status = 'confirmado'`),
    inserir: db.prepare(`
      INSERT INTO agendamentos
        (codigo, cliente_nome, cliente_telefone, servico_id, barbeiro_id, data, inicio, fim, preco, criado_em)
      VALUES
        (@codigo, @clienteNome, @clienteTelefone, @servicoId, @barbeiroId, @data, @inicio, @fim, @preco, @criadoEm)`),
    conflito: db.prepare(`
      SELECT 1 FROM agendamentos
      WHERE barbeiro_id = ? AND data = ? AND status = 'confirmado' AND inicio < ? AND ? < fim
      LIMIT 1`),
    porCodigo: db.prepare(`SELECT * FROM agendamentos WHERE codigo = ?`),
    cancelar: db.prepare(`
      UPDATE agendamentos SET status = 'cancelado', cancelado_em = ?
      WHERE codigo = ? AND status = 'confirmado'`),
    doDia: db.prepare(`SELECT * FROM agendamentos WHERE data = ? ORDER BY inicio, barbeiro_id`),
    ativosDoTelefone: db.prepare(`
      SELECT COUNT(*) AS total FROM agendamentos
      WHERE cliente_telefone = ? AND status = 'confirmado'
        AND (data > ? OR (data = ? AND inicio > ?))`),
  };

  // O banco usa snake_case e o JavaScript camelCase, então a gente converte aqui
  const paraObjeto = (linha) => linha && {
    id: linha.id,
    codigo: linha.codigo,
    clienteNome: linha.cliente_nome,
    clienteTelefone: linha.cliente_telefone,
    servicoId: linha.servico_id,
    barbeiroId: linha.barbeiro_id,
    data: linha.data,
    inicio: linha.inicio,
    fim: linha.fim,
    preco: linha.preco,
    status: linha.status,
    criadoEm: linha.criado_em,
    canceladoEm: linha.cancelado_em,
  };

  /**
   * Checa conflito e insere DENTRO da mesma transação.
   * Sem isso, dois clientes clicando no mesmo horário quase juntos poderiam
   * passar os dois pela checagem antes de qualquer um salvar (condição de corrida).
   */
  const inserirSeLivre = db.transaction((a) => {
    if (sql.conflito.get(a.barbeiroId, a.data, a.fim, a.inicio)) return null;
    sql.inserir.run(a);
    return paraObjeto(sql.porCodigo.get(a.codigo));
  });

  return {
    ocupados: (barbeiroId, data) => sql.ocupados.all(barbeiroId, data),
    inserirSeLivre,
    buscarPorCodigo: (codigo) => paraObjeto(sql.porCodigo.get(codigo)),
    cancelar: (codigo, quando) => sql.cancelar.run(quando, codigo).changes === 1,
    doDia: (data) => sql.doDia.all(data).map(paraObjeto),
    contarAtivosDoTelefone: (telefone, agora) =>
      sql.ativosDoTelefone.get(telefone, agora.data, agora.data, agora.minutos).total,
    fechar: () => db.close(),
  };
}

module.exports = { criarRepositorio };
