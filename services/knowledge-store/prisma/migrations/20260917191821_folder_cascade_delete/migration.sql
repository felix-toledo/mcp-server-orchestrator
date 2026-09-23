-- DropForeignKey
ALTER TABLE "public"."KnowledgeEntry" DROP CONSTRAINT "KnowledgeEntry_folderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."VaultFolder" DROP CONSTRAINT "VaultFolder_parentId_fkey";

-- AddForeignKey
ALTER TABLE "public"."KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "public"."VaultFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VaultFolder" ADD CONSTRAINT "VaultFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."VaultFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
