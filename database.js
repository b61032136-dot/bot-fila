// Banco de dados em memória (use um banco real em produção como SQLite/MongoDB)

const db = {
  // Filas: { "gelo_normal_1x1": [{userId, username, guildId, channelId}] }
  filas: {},

  // Chaves Pix dos ADMs: { userId: "chave_pix" }
  pixKeys: {},

  // Salas de jogo ativas: { "fila-XXXX": { players: [], mode: "1x1", value: 10, confirmed: [] } }
  salas: {},

  // Tickets: { channelId: { userId, type, assignedAdm, openedAt } }
  tickets: {},
};

// ── FILAS ──────────────────────────────────────────────
function getFilaKey(mode, tipo) {
  return `${tipo}_${mode}`;
}

function entrarFila(mode, tipo, user) {
  const key = getFilaKey(mode, tipo);
  if (!db.filas[key]) db.filas[key] = [];

  // Evitar duplicata
  const jaEsta = db.filas[key].find(p => p.userId === user.userId);
  if (jaEsta) return { success: false, reason: 'already_in' };

  db.filas[key].push(user);
  return { success: true, fila: db.filas[key] };
}

function sairFila(userId) {
  let saiu = false;
  for (const key in db.filas) {
    const antes = db.filas[key].length;
    db.filas[key] = db.filas[key].filter(p => p.userId !== userId);
    if (db.filas[key].length < antes) saiu = true;
  }
  return saiu;
}

function getFila(mode, tipo) {
  const key = getFilaKey(mode, tipo);
  return db.filas[key] || [];
}

function getFilaSize(mode) {
  // Retorna quantos jogadores são necessários por equipe
  const map = { '1x1': 2, '2x2': 4, '3x3': 6, '4x4': 8 };
  return map[mode] || 2;
}

function checkFilaCompleta(mode, tipo) {
  const key = getFilaKey(mode, tipo);
  const fila = db.filas[key] || [];
  const needed = getFilaSize(mode);
  return fila.length >= needed ? fila.slice(0, needed) : null;
}

function removerDaFila(mode, tipo, players) {
  const key = getFilaKey(mode, tipo);
  const ids = players.map(p => p.userId);
  db.filas[key] = (db.filas[key] || []).filter(p => !ids.includes(p.userId));
}

// ── PIX ──────────────────────────────────────────────
function registrarPix(userId, chave) {
  db.pixKeys[userId] = chave;
}

function getPix(userId) {
  return db.pixKeys[userId] || null;
}

// ── SALAS ────────────────────────────────────────────
function criarSala(channelId, { players, mode, tipo, value }) {
  db.salas[channelId] = { players, mode, tipo, value, confirmed: [], createdAt: Date.now() };
}

function getSala(channelId) {
  return db.salas[channelId] || null;
}

function confirmarJogador(channelId, userId) {
  const sala = db.salas[channelId];
  if (!sala) return null;
  if (!sala.confirmed.includes(userId)) sala.confirmed.push(userId);
  return sala;
}

function deletarSala(channelId) {
  delete db.salas[channelId];
}

// ── TICKETS ──────────────────────────────────────────
function criarTicket(channelId, data) {
  db.tickets[channelId] = { ...data, assignedAdm: null, openedAt: Date.now() };
}

function getTicket(channelId) {
  return db.tickets[channelId] || null;
}

function assumirTicket(channelId, admId, admTag) {
  if (!db.tickets[channelId]) return null;
  db.tickets[channelId].assignedAdm = admId;
  db.tickets[channelId].assumedAt = Date.now();
  db.tickets[channelId].admTag = admTag;
  return db.tickets[channelId];
}

function fecharTicket(channelId) {
  delete db.tickets[channelId];
}

module.exports = {
  entrarFila, sairFila, getFila, checkFilaCompleta, removerDaFila, getFilaSize,
  registrarPix, getPix,
  criarSala, getSala, confirmarJogador, deletarSala,
  criarTicket, getTicket, assumirTicket, fecharTicket,
};
