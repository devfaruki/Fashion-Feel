/*
  Warnings:

  - You are about to drop the column `deliveryCharge` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the `_productfilteroptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `filter` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `filter_option` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `_productfilteroptions` DROP FOREIGN KEY `_ProductFilterOptions_A_fkey`;

-- DropForeignKey
ALTER TABLE `_productfilteroptions` DROP FOREIGN KEY `_ProductFilterOptions_B_fkey`;

-- DropForeignKey
ALTER TABLE `filter_option` DROP FOREIGN KEY `filter_option_filterId_fkey`;

-- AlterTable
ALTER TABLE `customer` DROP COLUMN `deliveryCharge`;

-- DropTable
DROP TABLE `_productfilteroptions`;

-- DropTable
DROP TABLE `filter`;

-- DropTable
DROP TABLE `filter_option`;
