/**
 * Ponto de partida: monta as peças e sobe o servidor.
 *   npm start  ->  http://localhost:3000
 */
const path = require("node:path");
const config = require("./config");
const { criarRepositorio } = require("./repositorio");
const { criarServicoAgendamento } = require("./servico");
const { criarApp } = require("./app");

const repo = criarRepositorio(path.join(__dirname, "..", "data", "barbearia.db"));
const servico = criarServicoAgendamento({ repo, config });
const app = criarApp({ servico, senhaAdmin: config.senhaAdmin });

const porta = Number(process.env.PORT) || 3000;
app.listen(porta, () => {
  console.log(`✂️  ${config.nome} rodando em http://localhost:${porta}`);
  console.log(`   Painel do barbeiro: http://localhost:${porta}/admin.html`);
  if (!process.env.ADMIN_SENHA) console.log(`   (senha padrão do painel: ${config.senhaAdmin})`);
});
