/*
  Warnings:

  - A unique constraint covering the columns `[avatarUrl]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_avatarUrl_key" ON "User"("avatarUrl");
