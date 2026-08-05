/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `customer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `brand` ADD COLUMN `status` VARCHAR(191) NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE `category` ADD COLUMN `status` VARCHAR(191) NULL DEFAULT 'active';

-- CreateIndex
CREATE UNIQUE INDEX `customer_phone_key` ON `customer`(`phone`);
