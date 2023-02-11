import { Client, User, AttachmentBuilder, TextChannel } from "discord.js";
import { config } from "dotenv";
import { schedule } from "node-cron";

import { Prisma, PrismaClient, Usuario } from "@prisma/client";

const prisma = new PrismaClient();

// Load environment variables
config();

const client = new Client({
  intents: [
    "Guilds",
    "GuildMessages",
    "GuildVoiceStates",
    "GuildMessages",
    "MessageContent",
  ],
});

const saideirasId = [
  process.env.SAIDEIRA_ID,
  process.env.CAIDEIRA_ID,
  process.env.ESTUDOS_ID,
];

client.login(process.env.TOKEN);

client.on("ready", () => {
  console.log("Ready!");
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Verificar se o canal de voz é o canal de voz da sede
  if (saideirasId.includes(newState.channelId || oldState.channelId || ""))
    return;

  // Verificar se o usuário que entrou não tem o cargo chamado "Membro"
  if (!newState.member?.roles.cache.find((role) => role.name === "Membro")) {
    return;
  }

  // Verificar se o usuário que entrou existe no banco de dados

  if (newState.member?.user.bot) return;
  const nickname =
    newState.member?.nickname || newState.member?.user.username || "";

  if (oldState.channelId === null && newState.channelId !== null) {
    // O usuário entrou em um canal de voz

    if (newState.member?.user) {
      const user = await verifyUser(newState.member.user, nickname);
      const activity = await createActivity(newState.member.user, nickname);
    }
  }

  // Verificar se o usuário que saiu do canal de voz existe no banco de dados

  if (oldState.channelId !== null && newState.channelId === null) {
    // O usuário saiu de um canal de voz
    console.log("O usuário " + nickname + " saiu do canal de voz.");
    if (oldState.member?.user) {
      const user = await verifyUser(oldState.member.user, nickname);

      let activity = await prisma.atividade.findFirst({
        where: {
          userId: user.id,
          finalDate: null,
        },
      });

      if (!activity) return;

      const updateFinalDate = await prisma.atividade.update({
        where: {
          id: activity.id,
        },
        data: {
          finalDate: new Date(),
        },
      });

      if (updateFinalDate.finalDate)
        activity = await prisma.atividade.update({
          where: {
            id: activity.id,
          },
          data: {
            totalTime:
              updateFinalDate.finalDate.getTime() -
              activity.initialDate.getTime(),
          },
        });

      const totalWeeklyTime = await userTotalTime(
        oldState.member.user,
        nickname
      );
      console.log(
        "Total de tempo na semana do usuário " +
          user.username +
          ": " +
          totalWeeklyTime.toFixed(2) +
          " horas"
      );
    }
  }
});

const verifyUser = async (
  discordUser: User,
  nickname: string
): Promise<Usuario> => {
  const userBanco = await prisma.usuario.findUnique({
    where: {
      discordId: discordUser.id,
    },
  });

  if (!userBanco) {
    return await prisma.usuario.create({
      data: {
        discordId: discordUser.id,
        username: nickname,
        avatarUrl:
          discordUser.avatarURL() ||
          "https://cdn.discordapp.com/embed/avatars/0.png",
        totalWeeklyTime: 0,
      },
    });
  }
  return userBanco;
};

const createActivity = async (user: User, nickname: string) => {
  const userBanco = await verifyUser(user, nickname);

  const activity = await prisma.atividade.create({
    data: {
      userId: userBanco.id,
      initialDate: new Date(),
      finalDate: null,
      totalTime: 0,
    },
  });

  return activity;
};

const deleteAllActivities = async () => {
  await prisma.atividade.deleteMany();
  await prisma.usuario.updateMany({
    data: {
      totalWeeklyTime: 0,
    },
  });
};

const userTotalTime = async (user: User, nickname: string) => {
  const userBanco = await verifyUser(user, nickname);

  const activities = await prisma.atividade.findMany({
    where: {
      userId: userBanco.id,
    },
  });

  let totalWeeklyTime = 0;

  activities.forEach((activity) => {
    if (activity.totalTime) {
      totalWeeklyTime += activity.totalTime;
    }
  });

  totalWeeklyTime = totalWeeklyTime / 1000 / 60 / 60;

  await prisma.usuario.update({
    where: {
      id: userBanco.id,
    },
    data: {
      totalWeeklyTime,
    },
  });

  return totalWeeklyTime;
};

client.on("messageCreate", async (message) => {
  if (message.content === "!sede") {
    const user = await verifyUser(message.author, message.author.username);

    if (!user) {
      message.reply("Você não está cadastrado no banco de dados.");
      return;
    }

    const totalWeeklyTime = await userTotalTime(
      message.author,
      message.author.username
    );
    message.reply(
      "Olá " +
        user.username +
        ", você já passou " +
        totalWeeklyTime.toFixed(2) +
        " horas na sede essa semana."
    );
  }
});

const exportar = async () => {
  const users = await (
    await prisma.usuario.findMany()
  ).sort((a, b) => {
    return b.username < a.username ? 1 : -1;
  });

  const firstDayOfWeek = new Date();
  firstDayOfWeek.setDate(firstDayOfWeek.getDate() - firstDayOfWeek.getDay());
  const lastDayOfWeek = new Date();
  lastDayOfWeek.setDate(lastDayOfWeek.getDate() + (6 - lastDayOfWeek.getDay()));

  let csv =
    "Horário de Sede " +
    firstDayOfWeek.toLocaleDateString() +
    " - " +
    lastDayOfWeek.toLocaleDateString() +
    "\n\n";

  users.forEach((user) => {
    csv += user.username + ";" + user.totalWeeklyTime.toFixed(2) + "\n";
  });

  const attachment = new AttachmentBuilder(Buffer.from(csv), {
    name:
      "sede - " +
      firstDayOfWeek.toLocaleDateString() +
      " - " +
      lastDayOfWeek.toLocaleDateString() +
      ".csv",
  });

  return attachment;
};

// Exportar os dados da semana para um csv

client.on("messageCreate", async (message) => {
  if (message.content === "!exportar") {
    const attachment = await exportar();
    message.reply({ files: [attachment] });
  }
});

client.on("messageCreate", async (message) => {
  if (message.content === "!resetar") {
    await deleteAllActivities();
    message.reply("Dados de horário de sede resetados com sucesso!");
  }
});

// Ás 23:59:59 de domingo, deletar todas as atividades e zerar o total de horas da semana
schedule(
  "09 23 * * 0",
  () => {
    const channel = client.channels.cache.get("1072269855471976449");
    if (channel) {
      (channel as TextChannel).send(
        "Os horários de sede serão exportados, saia do canal de voz para que o bot registre sua saída."
      );
    }
  },
  {
    scheduled: true,
    timezone: "America/Sao_Paulo",
  }
);

schedule(
  "14 23 * * 0",
  async () => {
    console.log("Deletando atividades e zerando horas da semana...");
    const channel = client.channels.cache.get("1072269855471976449");
    if (channel) {
      const attachment = await exportar();
      (channel as TextChannel).send("Horário de sede da semana:");
      (channel as TextChannel).send({ files: [attachment] });
    }
    await deleteAllActivities();
  },
  {
    scheduled: true,
    timezone: "America/Sao_Paulo",
  }
);
