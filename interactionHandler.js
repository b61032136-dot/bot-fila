const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, PermissionsBitField
} = require('discord.js');
const db = require('../database');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, guild, member, user } = interaction;

    // ══════════════════════════════════════════════
    //  BOTÕES DE FILA
    // ══════════════════════════════════════════════
    if (customId.startsWith('fila_')) {
      const partes = customId.split('_');
      // fila_geloInfinito_1x1_10
      const acao = partes[1];  // geloInfinito | geloNormal | sair
      const modo = partes[2];  // 1x1 | 2x2 | 3x3 | 4x4
      const valor = parseFloat(partes[3]);

      if (acao === 'sair') {
        const saiu = db.sairFila(user.id);
        if (!saiu) {
          return interaction.reply({ content: '❌ Você não estava em nenhuma fila!', ephemeral: true });
        }
        await atualizarEmbedFila(interaction, modo, valor);
        return interaction.reply({ content: '✅ Você saiu da fila!', ephemeral: true });
      }

      // Entrar na fila
      const tipo = acao === 'geloInfinito' ? 'gelo_infinito' : 'gelo_normal';
      const tipoLabel = acao === 'geloInfinito' ? '❄️ Gelo Infinito' : '🧊 Gelo Normal';

      // Sair de filas anteriores primeiro
      db.sairFila(user.id);

      const resultado = db.entrarFila(modo, tipo, {
        userId: user.id,
        username: user.username,
        displayName: member.displayName,
      });

      if (!resultado.success) {
        return interaction.reply({ content: '❌ Você já está nessa fila!', ephemeral: true });
      }

      await atualizarEmbedFila(interaction, modo, valor);
      await interaction.reply({ content: `✅ Você entrou na fila **${tipoLabel}** | ${modo} | R$ ${valor.toFixed(2).replace('.', ',')}`, ephemeral: true });

      // Verificar se fila está completa
      const filaCompleta = db.checkFilaCompleta(modo, tipo);
      if (filaCompleta) {
        db.removerDaFila(modo, tipo, filaCompleta);
        await atualizarEmbedFila(interaction, modo, valor);
        await criarSalaDeJogo(interaction, filaCompleta, modo, tipo, valor, guild);
      }
      return;
    }

    // ══════════════════════════════════════════════
    //  BOTÕES DE CONFIRMAR NA SALA
    // ══════════════════════════════════════════════
    if (customId.startsWith('sala_confirmar_')) {
      const channelId = interaction.channel.id;
      const sala = db.getSala(channelId);
      if (!sala) return interaction.reply({ content: '❌ Sala não encontrada!', ephemeral: true });

      const isPlayer = sala.players.find(p => p.userId === user.id);
      if (!isPlayer) return interaction.reply({ content: '❌ Você não faz parte desta sala!', ephemeral: true });

      const salaAtualizada = db.confirmarJogador(channelId, user.id);
      const totalJogadores = sala.players.length;
      const confirmados = salaAtualizada.confirmed.length;

      await interaction.reply({ content: `✅ **${member.displayName}** confirmou! (${confirmados}/${totalJogadores})`, ephemeral: false });

      // Todos confirmaram?
      if (confirmados >= totalJogadores) {
        await enviarParaAdm(interaction, sala, channelId);
      }
      return;
    }

    // ══════════════════════════════════════════════
    //  BOTÃO MANDAR PIX (ADM)
    // ══════════════════════════════════════════════
    if (customId.startsWith('adm_mandarpix_')) {
      const isAdm = member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isAdm) return interaction.reply({ content: '❌ Apenas ADMs!', ephemeral: true });

      const salaChannelId = customId.replace('adm_mandarpix_', '');
      const sala = db.getSala(salaChannelId);
      if (!sala) return interaction.reply({ content: '❌ Sala não encontrada!', ephemeral: true });

      const chave = db.getPix(user.id);
      if (!chave) {
        return interaction.reply({
          content: '❌ Você não tem chave Pix registrada! Use `!registrarpix SUA_CHAVE`',
          ephemeral: true,
        });
      }

      const valorStr = sala.value.toFixed(2).replace('.', ',');
      const tipoLabel = sala.tipo === 'gelo_infinito' ? '❄️ Gelo Infinito' : '🧊 Gelo Normal';

      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('💸 Informações de Pagamento')
        .setDescription(`O ADM **${member.displayName}** liberou o Pix para esta partida!`)
        .addFields(
          { name: '🔑 Chave Pix', value: `\`\`\`${chave}\`\`\`` },
          { name: '💰 Valor a Enviar', value: `**R$ ${valorStr}**`, inline: true },
          { name: '🎮 Modo', value: sala.mode, inline: true },
          { name: '🧊 Tipo', value: tipoLabel, inline: true },
          { name: '👥 Jogadores', value: sala.players.map(p => `• ${p.displayName}`).join('\n') },
          { name: '📋 Instrução', value: 'Envie o Pix, aguarde o ADM criar a sala e boa sorte! 🔥' },
        )
        .setFooter({ text: 'Free Fire Apostas' })
        .setTimestamp();

      // Enviar no canal da sala
      const salaChannel = guild.channels.cache.get(salaChannelId);
      if (salaChannel) await salaChannel.send({ embeds: [embed] });

      await interaction.reply({ content: '✅ Pix enviado para o canal da sala!', ephemeral: true });
      return;
    }

    // ══════════════════════════════════════════════
    //  BOTÕES DE TICKET
    // ══════════════════════════════════════════════
    if (customId.startsWith('ticket_')) {
      const tipo = customId.replace('ticket_', '');
      const tipoLabels = {
        reembolso: '💸 Reembolso',
        vaga: '🛡️ Vaga ADM/SS',
        suporte: '🔧 Suporte',
        wo: '🏆 Vitória por W.O',
      };
      await criarTicket(interaction, tipo, tipoLabels[tipo]);
      return;
    }

    if (customId.startsWith('ticket_fechar_')) {
      await fecharTicket(interaction);
      return;
    }

    if (customId.startsWith('ticket_assumir_')) {
      await assumirTicket(interaction);
      return;
    }

    if (customId.startsWith('ticket_notifadm_')) {
      const channelId = interaction.channel.id;
      const admRole = process.env.ADMIN_ROLE_ID;
      await interaction.reply({ content: admRole ? `<@&${admRole}> há um ticket aguardando!` : '🔔 ADMs, há um ticket aguardando!', ephemeral: false });
      return;
    }

    if (customId.startsWith('ticket_notifmembro_')) {
      const ticket = db.getTicket(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: '❌ Ticket não encontrado!', ephemeral: true });
      await interaction.reply({ content: `<@${ticket.userId}> você foi notificado sobre seu ticket!`, ephemeral: false });
      return;
    }

    if (customId.startsWith('ticket_addmembro_')) {
      await interaction.reply({ content: '📝 Mencione o membro que deseja adicionar: `@membro`', ephemeral: true });
      return;
    }
  });
};

// ── ATUALIZAR EMBED DA FILA ──────────────────────────────────
async function atualizarEmbedFila(interaction, modo, valor) {
  try {
    const tiposEmoji = { gelo_infinito: '❄️ Gelo Infinito', gelo_normal: '🧊 Gelo Normal' };
    let jogadoresText = '';

    for (const [tipo, emoji] of Object.entries(tiposEmoji)) {
      const fila = db.getFila(modo, tipo);
      if (fila.length > 0) {
        jogadoresText += `**${emoji}:**\n${fila.map(p => `• ${p.displayName}`).join('\n')}\n`;
      }
    }

    const needed = db.getFilaSize(modo);
    const valorStr = valor.toFixed(2).replace('.', ',');

    const embed = new EmbedBuilder()
      .setColor('#1a1a2e')
      .setTitle(`🎮 ${modo} | Fila`)
      .addFields(
        { name: '▶️ Formato', value: `\`${modo} Mobile\``, inline: true },
        { name: '💰 Preço', value: `\`R$ ${valorStr}\``, inline: true },
        { name: '\u200b', value: '\u200b' },
        { name: `👑 Jogadores (necessários: ${needed})`, value: jogadoresText || 'Sem jogadores...', inline: false },
      )
      .setFooter({ text: 'Free Fire Apostas • Escolha sua fila' })
      .setTimestamp();

    await interaction.message.edit({ embeds: [embed] });
  } catch (e) {
    console.error('Erro ao atualizar embed:', e);
  }
}

// ── CRIAR SALA DE JOGO ───────────────────────────────────────
async function criarSalaDeJogo(interaction, players, modo, tipo, valor, guild) {
  const codigo = Math.floor(1000 + Math.random() * 9000);
  const nomeCanal = `fila-${codigo}`;

  const admRoleId = process.env.ADMIN_ROLE_ID;
  const categoriaId = process.env.FILA_CATEGORY_ID;

  const permissoes = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
  ];

  // Adicionar permissão dos jogadores
  for (const player of players) {
    permissoes.push({
      id: player.userId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
    });
  }

  // Adicionar permissão dos ADMs
  if (admRoleId) {
    permissoes.push({
      id: admRoleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
    });
  }

  const canal = await guild.channels.create({
    name: nomeCanal,
    type: ChannelType.GuildText,
    parent: categoriaId || null,
    permissionOverwrites: permissoes,
  });

  db.criarSala(canal.id, { players, mode: modo, tipo, value: valor });

  const tipoLabel = tipo === 'gelo_infinito' ? '❄️ Gelo Infinito' : '🧊 Gelo Normal';
  const valorStr = valor.toFixed(2).replace('.', ',');

  const embed = new EmbedBuilder()
    .setColor('#e74c3c')
    .setTitle(`🔥 Sala Criada! | ${modo} - ${tipoLabel}`)
    .setDescription('A fila encheu! Confirmem para iniciar a partida.')
    .addFields(
      { name: '🎮 Modo', value: modo, inline: true },
      { name: '💰 Valor', value: `R$ ${valorStr}`, inline: true },
      { name: '🧊 Tipo', value: tipoLabel, inline: true },
      { name: '👥 Jogadores', value: players.map(p => `<@${p.userId}>`).join('\n') },
      { name: '📋 Instrução', value: 'Todos devem clicar em **Confirmar** para prosseguir!' },
    )
    .setFooter({ text: `Sala: ${nomeCanal}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sala_confirmar_${canal.id}`)
      .setLabel('✅ Confirmar')
      .setStyle(ButtonStyle.Success),
  );

  await canal.send({
    content: players.map(p => `<@${p.userId}>`).join(' '),
    embeds: [embed],
    components: [row],
  });
}

// ── ENVIAR PARA O CANAL ADM ──────────────────────────────────
async function enviarParaAdm(interaction, sala, salaChannelId) {
  const admChannelId = process.env.ADMIN_CHANNEL_ID;
  if (!admChannelId) return;

  const admChannel = interaction.guild.channels.cache.get(admChannelId);
  if (!admChannel) return;

  const tipoLabel = sala.tipo === 'gelo_infinito' ? '❄️ Gelo Infinito' : '🧊 Gelo Normal';
  const valorStr = sala.value.toFixed(2).replace('.', ',');

  const embed = new EmbedBuilder()
    .setColor('#e67e22')
    .setTitle('💰 Nova Partida Confirmada! — Ação ADM')
    .setDescription('Todos os jogadores confirmaram! Envie o Pix e crie a sala.')
    .addFields(
      { name: '🎮 Modo', value: sala.mode, inline: true },
      { name: '💰 Valor', value: `R$ ${valorStr}`, inline: true },
      { name: '🧊 Tipo', value: tipoLabel, inline: true },
      { name: '👥 Jogadores', value: sala.players.map(p => `<@${p.userId}>`).join('\n') },
      { name: '📍 Canal', value: `<#${salaChannelId}>` },
    )
    .setFooter({ text: 'Free Fire Apostas • Painel ADM' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`adm_mandarpix_${salaChannelId}`)
      .setLabel('💸 Mandar Pix')
      .setStyle(ButtonStyle.Success),
  );

  await admChannel.send({ embeds: [embed], components: [row] });

  // Atualizar embed da sala
  const embed2 = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle('✅ Todos Confirmaram!')
    .setDescription('Aguardando o ADM criar a sala e enviar o Pix. Fiquem atentos!')
    .setTimestamp();

  await interaction.channel.send({ embeds: [embed2] });
}

// ── CRIAR TICKET ─────────────────────────────────────────────
async function criarTicket(interaction, tipo, tipoLabel) {
  const guild = interaction.guild;
  const user = interaction.user;
  const member = interaction.member;

  const admRoleId = process.env.ADMIN_ROLE_ID;
  const ownerRoleId = process.env.OWNER_ROLE_ID;
  const categoriaId = process.env.TICKET_CATEGORY_ID;

  const codigo = Math.floor(100 + Math.random() * 900);
  const nomeCanal = `ticket-${codigo}`;

  const permissoes = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
  ];

  if (admRoleId) {
    permissoes.push({
      id: admRoleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
    });
  }
  if (ownerRoleId) {
    permissoes.push({
      id: ownerRoleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
    });
  }

  const canal = await guild.channels.create({
    name: nomeCanal,
    type: ChannelType.GuildText,
    parent: categoriaId || null,
    permissionOverwrites: permissoes,
  });

  db.criarTicket(canal.id, { userId: user.id, userTag: user.tag, tipo });

  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle(`🎫 Ticket | ${tipoLabel}`)
    .setDescription(`Olá <@${user.id}>! Seu ticket foi aberto.\nAguarde um ADM assumir o atendimento.`)
    .addFields(
      { name: '📋 Motivo', value: tipoLabel, inline: true },
      { name: '👤 Usuário', value: member.displayName, inline: true },
      { name: '⏰ Aberto em', value: `<t:${Math.floor(Date.now() / 1000)}:F>` },
    )
    .setFooter({ text: 'Free Fire Apostas • Suporte' })
    .setTimestamp();

  // Botões ADM
  const rowAdm = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_assumir_${canal.id}`)
      .setLabel('🙋 Assumir Ticket')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket_notifadm_${canal.id}`)
      .setLabel('🔔 Notificar ADM')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket_notifmembro_${canal.id}`)
      .setLabel('📨 Notificar Membro')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket_addmembro_${canal.id}`)
      .setLabel('➕ Adicionar Membro')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket_fechar_${canal.id}`)
      .setLabel('🔒 Fechar Ticket')
      .setStyle(ButtonStyle.Danger),
  );

  await canal.send({
    content: `<@${user.id}>`,
    embeds: [embed],
    components: [rowAdm],
  });

  await interaction.reply({ content: `✅ Ticket criado! Acesse <#${canal.id}>`, ephemeral: true });
}

// ── ASSUMIR TICKET ───────────────────────────────────────────
async function assumirTicket(interaction) {
  const user = interaction.user;
  const member = interaction.member;
  const isAdm = member.permissions.has(PermissionFlagsBits.Administrator);

  if (!isAdm) {
    return interaction.reply({ content: '❌ Apenas ADMs podem assumir tickets!', ephemeral: true });
  }

  const channelId = interaction.channel.id;
  const ticket = db.getTicket(channelId);
  if (!ticket) return interaction.reply({ content: '❌ Ticket não encontrado!', ephemeral: true });

  if (ticket.assignedAdm) {
    return interaction.reply({ content: `❌ Este ticket já foi assumido por <@${ticket.assignedAdm}>!`, ephemeral: true });
  }

  const dados = db.assumirTicket(channelId, user.id, user.tag);
  const tempoAberto = Math.floor((Date.now() - ticket.openedAt) / 1000);
  const foiRapido = tempoAberto < 600; // menos de 10 minutos

  const mensagemVelocidade = foiRapido
    ? `⚡ Uau, seu ticket foi atendido tão rápido! (${tempoAberto}s)`
    : `😅 Poxa, ele demorou mais chegou! (${Math.floor(tempoAberto / 60)}min ${tempoAberto % 60}s)`;

  const embed = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle('✅ Ticket Assumido!')
    .setDescription(`${mensagemVelocidade}\n\n**ADM responsável:** ${member.displayName}`)
    .setFooter({ text: 'Free Fire Apostas • Suporte' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// ── FECHAR TICKET ────────────────────────────────────────────
async function fecharTicket(interaction) {
  const member = interaction.member;
  const isAdm = member.permissions.has(PermissionFlagsBits.Administrator);
  const ticket = db.getTicket(interaction.channel.id);

  const isDono = ticket && ticket.userId === interaction.user.id;

  if (!isAdm && !isDono) {
    return interaction.reply({ content: '❌ Apenas ADMs ou o dono do ticket podem fechá-lo!', ephemeral: true });
  }

  await interaction.reply({ content: '🔒 Fechando ticket em 5 segundos...' });

  db.fecharTicket(interaction.channel.id);
  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}
