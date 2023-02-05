import { Client, User } from "discord.js";
import { config } from "dotenv";

import { Prisma, PrismaClient, Usuario } from "@prisma/client";

const prisma = new PrismaClient();

// Load environment variables
config();

const client = new Client({
  intents: ["Guilds", "GuildMessages", "GuildVoiceStates"],
});

client.login(process.env.TOKEN);

client.on("ready", () => {
  console.log("Ready!");
});

client.on("messageCreate", function (message) {
  console.log(`a message was created`);
  console.log({ message });
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Verificar se o usuário que entrou existe no banco de dados

  if (newState.member?.user.bot) return;

  if (oldState.channelId === null && newState.channelId !== null) {
    // O usuário entrou em um canal de voz

    if (newState.member?.user) {
      const user = await verifyUser(newState.member.user);
      console.log("O usuário entrou num canal de voz -> " + user.username);

      const activity = await createActivity(newState.member.user);
      console.log("Atividade criada -> " + activity.id);
    }
  }

  // Verificar se o usuário que saiu do canal de voz existe no banco de dados

  if (oldState.channelId !== null && newState.channelId === null) {
    // O usuário saiu de um canal de voz

    if (oldState.member?.user) {
      const user = await verifyUser(oldState.member.user);
      console.log("O usuário saiu de um canal de voz -> " + user.username);

      const activity = await prisma.atividade.findFirst({
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
        await prisma.atividade.update({
          where: {
            id: activity.id,
          },
          data: {
            totalTime:
              updateFinalDate.finalDate.getTime() -
              activity.initialDate.getTime(),
          },
        });

      console.log("Atividade finalizada -> " + activity.id);
      console.log("Tempo total -> " + activity.totalTime);
    }
  }
});

const verifyUser = async (discordUser: User): Promise<Usuario> => {
  const userBanco = await prisma.usuario.findUnique({
    where: {
      discordId: discordUser.id,
    },
  });

  if (!userBanco) {
    return await prisma.usuario.create({
      data: {
        discordId: discordUser.id,
        username: discordUser.username,
        avatarUrl:
          discordUser.avatarURL() ||
          "https://cdn.discordapp.com/embed/avatars/0.png",
        totalWeeklyTime: 0,
      },
    });
  }
  return userBanco;
};

const createActivity = async (user: User) => {
  const userBanco = await verifyUser(user);

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
