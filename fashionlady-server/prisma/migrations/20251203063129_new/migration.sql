/*
  Warnings:

  - You are about to drop the `_ProductFilters` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `_ProductFilters` DROP FOREIGN KEY `_ProductFilters_A_fkey`;

-- DropForeignKey
ALTER TABLE `_ProductFilters` DROP FOREIGN KEY `_ProductFilters_B_fkey`;

-- DropTable
DROP TABLE `_ProductFilters`;
