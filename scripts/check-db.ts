import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const configs = await prisma.ragConfig.findMany({
        select: {
            id: true,
            knowledgeBaseId: true,
            retrieverMode: true,
            vectorStore: true,
            topK: true,
            embeddingApiKey: true,
            updatedAt: true,
        },
    });
    console.log("=== RagConfig table contents ===");
    for (const config of configs) {
        console.log(JSON.stringify({
            ...config,
            embeddingApiKey: config.embeddingApiKey ? `${config.embeddingApiKey.slice(0, 10)}...` : null,
        }, null, 2));
    }
    await prisma.$disconnect();
}

main().catch(console.error);
