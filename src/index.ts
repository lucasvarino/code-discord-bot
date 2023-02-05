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

client.on("voiceStateUpdate", async (oldState, newState) => {
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

      //Transformar o tempo em horas
      totalWeeklyTime = totalWeeklyTime / 1000 / 60 / 60;
    }
  });

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
