// index.js — LTA Naraka Bot
// Slash commands + auto-notifier for Naraka Bladepoint maintenance windows

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const MAINT_START_H = 23; // 23:00 UTC — servers go DOWN
const MAINT_END_H   = 4;  // 04:00 UTC — servers come UP (next day)

const COLOR_BRONZE  = 0xc9842a;
const COLOR_DOWN    = 0xef4444;
const COLOR_UP      = 0x22c55e;
const FOOTER_TEXT   = 'LTA · Latinoamerican Guild · Naraka Bladepoint';

// Persistent state file (survives restarts, not redeploys)
const STATE_FILE = path.join(__dirname, 'state.json');

// ── STATE ────────────────────────────────────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {}
  return { maintDate: process.env.MAINT_DATE || new Date().toISOString().slice(0, 10), notifiedFor: null };
}

function saveState(state) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

let state = loadState();

// ── HELPERS ──────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

function getMaintWindow(dateStr) {
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(yr, mo - 1, dy,     MAINT_START_H, 0, 0));
  const end   = new Date(Date.UTC(yr, mo - 1, dy + 1, MAINT_END_H,   0, 0));
  return { start, end };
}

function getPhase() {
  const now  = Date.now();
  const { start, end } = getMaintWindow(state.maintDate);
  if (now < start.getTime())  return 'incoming';
  if (now < end.getTime())    return 'active';
  return 'done';
}

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function fmtDate(date) {
  return date.toUTCString().replace(' GMT', ' UTC');
}

// ── EMBEDS ───────────────────────────────────────────────────────────────────
function buildStatusEmbed() {
  const phase = getPhase();
  const { start, end } = getMaintWindow(state.maintDate);
  const now = Date.now();

  if (phase === 'incoming') {
    const msLeft = start.getTime() - now;
    return new EmbedBuilder()
      .setColor(COLOR_BRONZE)
      .setTitle('🟡 Servidores: ACTIVOS')
      .setDescription(`Los servidores están **en línea**.\nMantenimiento próximo el **${state.maintDate}**.`)
      .addFields(
        { name: '🔒 Cierre', value: fmtDate(start), inline: false },
        { name: '🔓 Apertura', value: fmtDate(end), inline: false },
        { name: '⏳ Tiempo hasta cierre', value: `\`${fmtCountdown(msLeft)}\``, inline: false }
      )
      .setFooter({ text: FOOTER_TEXT })
      .setTimestamp();
  }

  if (phase === 'active') {
    const msLeft = end.getTime() - now;
    return new EmbedBuilder()
      .setColor(COLOR_DOWN)
      .setTitle('🔴 Servidores: MANTENIMIENTO')
      .setDescription('Los servidores están **cerrados** por mantenimiento.')
      .addFields(
        { name: '🔓 Reapertura estimada', value: fmtDate(end), inline: false },
        { name: '⏳ Tiempo restante', value: `\`${fmtCountdown(msLeft)}\``, inline: false }
      )
      .setFooter({ text: FOOTER_TEXT })
      .setTimestamp();
  }

  // done
  return new EmbedBuilder()
    .setColor(COLOR_UP)
    .setTitle('🟢 Servidores: ABIERTOS')
    .setDescription('¡El mantenimiento terminó! **¡La batalla te espera, guerrero!** ⚔️')
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

function buildTimerEmbed() {
  const phase = getPhase();
  const { start, end } = getMaintWindow(state.maintDate);
  const now = Date.now();

  let title, color, timeLabel, timeValue, msLeft;

  if (phase === 'incoming') {
    color     = COLOR_BRONZE;
    title     = '⏳ Countdown — Próximo Mantenimiento';
    timeLabel = 'Servidores cierran en';
    msLeft    = start.getTime() - now;
  } else if (phase === 'active') {
    color     = COLOR_DOWN;
    title     = '⏳ Countdown — Reapertura';
    timeLabel = 'Servidores reabren en';
    msLeft    = end.getTime() - now;
  } else {
    return new EmbedBuilder()
      .setColor(COLOR_UP)
      .setTitle('✅ ¡Servidores Abiertos!')
      .setDescription('No hay mantenimiento activo. ¡A jugar! ⚔️')
      .setFooter({ text: FOOTER_TEXT })
      .setTimestamp();
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields({ name: timeLabel, value: `\`\`\`${fmtCountdown(msLeft)}\`\`\`` })
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

function buildHelpEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR_BRONZE)
    .setTitle('🔱 LTA Naraka Bot — Comandos')
    .addFields(
      { name: '/naraka status', value: 'Muestra si los servidores están activos o en mantenimiento.', inline: false },
      { name: '/naraka timer',  value: 'Countdown hasta la reapertura o cierre de servidores.',       inline: false },
      { name: '/naraka fecha `YYYY-MM-DD`', value: '*(Solo admins)* Actualiza la fecha del próximo mantenimiento.', inline: false },
      { name: '/naraka ayuda',  value: 'Esta lista de comandos.',                                     inline: false }
    )
    .setFooter({ text: FOOTER_TEXT });
}

// ── CLIENT ───────────────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  console.log(`📅 Fecha de mantenimiento: ${state.maintDate}`);
  startAutoNotifier();
});

// ── SLASH COMMANDS ────────────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'naraka') return;

  const sub = interaction.options.getSubcommand();

  try {
    if (sub === 'status') {
      await interaction.reply({ embeds: [buildStatusEmbed()] });

    } else if (sub === 'timer') {
      await interaction.reply({ embeds: [buildTimerEmbed()] });

    } else if (sub === 'ayuda') {
      await interaction.reply({ embeds: [buildHelpEmbed()], ephemeral: true });

    } else if (sub === 'fecha') {
      // Check admin permission
      if (!interaction.member.permissions.has('ManageGuild')) {
        return interaction.reply({ content: '❌ Solo los admins pueden cambiar la fecha.', ephemeral: true });
      }

      const newDate = interaction.options.getString('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        return interaction.reply({ content: '❌ Formato inválido. Usa `YYYY-MM-DD` (ej. `2026-05-19`).', ephemeral: true });
      }

      state.maintDate  = newDate;
      state.notifiedFor = null; // reset notif flag for new date
      saveState(state);

      const { start, end } = getMaintWindow(newDate);
      const embed = new EmbedBuilder()
        .setColor(COLOR_BRONZE)
        .setTitle('📅 Fecha de Mantenimiento Actualizada')
        .addFields(
          { name: '🔒 Cierre',    value: fmtDate(start), inline: false },
          { name: '🔓 Apertura',  value: fmtDate(end),   inline: false }
        )
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Error en comando:', err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Ocurrió un error. Intenta de nuevo.', ephemeral: true });
    }
  }
});

// ── AUTO-NOTIFIER ─────────────────────────────────────────────────────────────
function startAutoNotifier() {
  setInterval(async () => {
    const phase = getPhase();
    const { end } = getMaintWindow(state.maintDate);
    const windowKey = state.maintDate; // unique key per maintenance window

    // Only fire once per maintenance window, and only when done
    if (phase === 'done' && state.notifiedFor !== windowKey) {
      state.notifiedFor = windowKey;
      saveState(state);

      try {
        const channel = await client.channels.fetch(process.env.NOTIF_CHANNEL_ID);
        if (!channel) return console.warn('⚠️ Canal de notificación no encontrado.');

        const roleId  = process.env.NOTIF_ROLE_ID;
        const mention = roleId ? `<@&${roleId}>` : '@here';

        const embed = new EmbedBuilder()
          .setColor(COLOR_UP)
          .setTitle('🔱 ¡Servidores de Naraka Abiertos!')
          .setDescription(`**¡El mantenimiento ha concluido!**\n¡La batalla te espera, guerrero! ⚔️`)
          .addFields({ name: '🕐 Reabrieron a las', value: fmtDate(end), inline: false })
          .setFooter({ text: FOOTER_TEXT })
          .setTimestamp();

        await channel.send({ content: `${mention} ¡Los servidores están de vuelta!`, embeds: [embed] });
        console.log(`✅ Notificación enviada para el mantenimiento del ${windowKey}`);
      } catch (err) {
        console.error('❌ Error enviando notificación automática:', err);
      }
    }
  }, 30_000); // check every 30 seconds
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
