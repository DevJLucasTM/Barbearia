/**
 * Camada HTTP: rotas da API e arquivos do site.
 * Cada rota só pega os dados da requisição, chama o serviço e devolve JSON.
 */
const express = require("express");
const path = require("node:path");
const crypto = require("node:crypto");
const { ErroDeNegocio } = require("./servico");

function criarApp({ servico, senhaAdmin }) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  // ------------------------------------------------------------ público
  app.get("/api/informacoes", (req, res) => {
    res.json(servico.informacoes());
  });

  // GET /api/horarios?data=2026-11-12&servicoId=corte&barbeiroId=joao
  app.get("/api/horarios", (req, res) => {
    res.json(servico.listarHorarios(req.query));
  });

  app.post("/api/agendamentos", (req, res) => {
    res.status(201).json(servico.agendar(req.body ?? {}));
  });

  app.get("/api/agendamentos/:codigo", (req, res) => {
    res.json(servico.consultar(req.params.codigo));
  });

  // Cancelar não apaga: só marca como cancelado (fica no histórico)
  app.delete("/api/agendamentos/:codigo", (req, res) => {
    res.json(servico.cancelar(req.params.codigo));
  });

  // ------------------------------------------------------------- admin
  function exigirSenha(req, res, next) {
    const enviada = Buffer.from(String(req.get("x-admin-senha") ?? ""));
    const certa = Buffer.from(senhaAdmin);
    // timingSafeEqual compara em tempo constante: não dá pra descobrir a senha
    // medindo quanto tempo a resposta demora
    const ok = enviada.length === certa.length && crypto.timingSafeEqual(enviada, certa);
    if (!ok) return res.status(401).json({ erro: "Senha incorreta" });
    next();
  }

  app.get("/api/admin/agenda", exigirSenha, (req, res) => {
    res.json(servico.agendaDoDia(req.query.data));
  });

  // ------------------------------------------------------------- erros
  app.use("/api", (req, res) => res.status(404).json({ erro: "Rota não encontrada" }));

  // Middleware de erro do Express (tem 4 parâmetros, é assim que ele reconhece)
  app.use((erro, req, res, next) => {
    if (erro instanceof ErroDeNegocio) return res.status(erro.status).json({ erro: erro.message });
    if (erro.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido" });
    console.error(erro);
    res.status(500).json({ erro: "Deu ruim aqui do nosso lado. Tenta de novo daqui a pouco" });
  });

  return app;
}

module.exports = { criarApp };
