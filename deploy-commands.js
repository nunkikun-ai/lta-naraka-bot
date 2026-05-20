// deploy-commands.js -- register slash commands globally
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('naraka')
    .setDescription('Comandos del timer de mantenimiento de Naraka Bladepoint')
    .addSubcommand(sub =>
      sub.setName('status')
         .setDescription('Servidores abiertos o en mantenimiento?'))
    .addSubcommand(sub =>
      sub.setName('timer')
         .setDescription('Countdown hasta que los servidores reabran'))
    .addSubcommand(sub =>
      sub.setName('ayuda')
         .setDescription('Lista de comandos disponibles'))
    .addSubcommand(sub =>
      sub.setName('fecha')
         .setDescription('[Admin] Establece la fecha del proximo mantenimiento')
         .addStringOption(opt =>
           opt.setName('date')
              .setDescription('Fecha (YYYY-MM-DD)')
              .setRequired(true)))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registrando slash commands globales...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('OK - Slash commands globales registrados. Tardan hasta 1h en propagarse.');
  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
