/*
  Warnings:

  - Added the required column `deliveryCharge` to the `order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `order` ADD COLUMN `deliveryCharge` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `product` MODIFY `stock` VARCHAR(191) NULL DEFAULT 'available',
    MODIFY `rating` INTEGER NULL DEFAULT 0;
