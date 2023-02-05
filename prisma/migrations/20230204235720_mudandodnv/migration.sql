-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "initialDate" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "finalDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "avatarUrl" SET DEFAULT 'https://cdn.discordapp.com/embed/avatars/0.png';
