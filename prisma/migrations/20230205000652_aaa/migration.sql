/*
  Warnings:

  - Made the column `finalDate` on table `activities` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "activities" ALTER COLUMN "finalDate" SET NOT NULL;
