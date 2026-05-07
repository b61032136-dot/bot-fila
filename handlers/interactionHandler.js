
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits
} = require('discord.js');
const db = require('../database');

const VALORES_VALIDOS = [
  0.50, 1.00, 1.50, 2.00, 2.50, 3.00, 3.50, 4.00, 4.50, 5.00,
  6.00, 7.00, 8.00, 9.00, 10.00, 12.00, 15.00, 20.00, 25.00,
  30.00, 35.00, 40.00, 45.00, 50.00, 60.00, 70.00, 80.00, 90.00,
  100.00, 120.00, 150.00, 200.00, 250.00, 300.00
];

const MODOS_VALIDOS = ['1x1', '2x2', '3x3', '4x4'];

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const cmd = args[0].toLowerCase();

    // ── !fila [modo] [valor] ─────────────────────────────────
    if (cmd === 'fila') {
      const modo = args[1];
      const valorRaw = args[2]?.replace(',', '.');
      const valor = parseFloat(valorRaw);

      if (!modo || !MODOS_VALIDOS.includes(modo)) {
        return message.reply({
          embeds: [errorEmbed(`❌ Modo inválido! Use: \`!fila 1x1 10,00\`\nModos: ${MODOS_VALIDOS.join(', ')}`)],
        });
      }

      if (!valorRaw || isNaN(valor) || !VALORES_VALIDOS.includes(valor)) {
        return message.reply({
          embeds: [errorEmbed(`❌ Valor inválido! Valores aceitos: R$ 0,50 até R$ 300,00\nExemplo: \`!fila 1x1 10,00\``)],
        });
      }

      await message.delete().catch(() => {});
      await enviarPainelFila(message.channel, modo, valor, message.guild);
      return;
    }

    // ── !registrarpix [chave] ────────────────────────────────
    if (cmd === 'registrarpix') {
      const isAdm = message.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isAdm) {
        return message.reply({ embeds: [errorEmbed('❌ Apenas ADMs podem registrar chave Pix!')] });
      }

      const chave = args.slice(1).join(' ');
      if (!chave) {
        return message.reply({ embeds: [errorEmbed('❌ Use: `!registrarpix SUA_CHAVE_PIX`')] });
      }

      db.registrarPix(message.author.id, chave);
      await message.delete().catch(() => {});
      return message.channel.send({
        embeds: [successEmbed(`✅ Chave Pix registrada com sucesso, **${message.author.username}**!`)],
      }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    // ── !atendimento ─────────────────────────────────────────
    if (cmd === 'atendimento') {
      await message.delete().catch(() => {});
      await enviarPainelAtendimento(message.channel, message.author, message.guild);
      return;
    }
  });
};

// ── PAINEL DE FILA ───────────────────────────────────────────
async function enviarPainelFila(channel, modo, valor, guild) {
  const valorStr = valor.toFixed(2).replace('.', ',');

  const embed = new EmbedBuilder()
    .setColor('#1a1a2e')
    .setTitle(`🎮 ${modo} | Fila`)
    .addFields(
      { name: '▶️ Formato', value: `\`${modo} Mobile\``, inline: true },
      { name: '💰 Preço', value: `\`R$ ${valorStr}\``, inline: true },
      { name: '\u200b', value: '\u200b' },
      { name: '👑 Jogadores', value: 'Sem jogadores...', inline: false },
    )
    .setFooter({ text: 'Free Fire Apostas • Escolha sua fila' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fila_geloInfinito_${modo}_${valor}`)
      .setLabel('❄️ Gelo infinito')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`fila_geloNormal_${modo}_${valor}`)
      .setLabel('🧊 Gelo normal')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`fila_sair_${modo}_${valor}`)
      .setLabel('Sair')
      .setStyle(ButtonStyle.Danger),
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ── PAINEL DE ATENDIMENTO ────────────────────────────────────
async function enviarPainelAtendimento(channel, author, guild) {
  const embed = new EmbedBuilder()
    .setColor('#16213e')
    .setTitle('🎧 Central de Atendimento')
    .setDescription('Selecione o motivo do seu atendimento clicando em um dos botões abaixo:')
    .addFields(
      { name: '💸 Reembolso', value: 'Solicitar devolução de valor', inline: true },
      { name: '🛡️ Vaga de ADM/SS', value: 'Candidatar-se a staff', inline: true },
      { name: '🔧 Suporte', value: 'Problemas gerais', inline: true },
      { name: '🏆 Vitória por W.O', value: 'Registrar vitória por W.O', inline: true },
    )
    .setFooter({ text: `Solicitado por ${author.username}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_reembolso`)
      .setLabel('💸 Reembolso')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket_vaga`)
      .setLabel('🛡️ Vaga ADM/SS')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket_suporte`)
      .setLabel('🔧 Suporte')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket_wo`)
      .setLabel('🏆 Vitória por W.O')
      .setStyle(ButtonStyle.Primary),
  );

  await channel.send({ embeds: [embed], components: [row] });
}

function errorEmbed(msg) {
  return new EmbedBuilder().setColor('#e74c3c').setDescription(msg);
}

function successEmbed(msg) {
  return new EmbedBuilder().setColor('#2ecc71').setDescription(msg);
}
