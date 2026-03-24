import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
    if (prismaInstance) {
        return prismaInstance;
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is required");
    }

    const adapter = new PrismaPg({ connectionString });
    prismaInstance = new PrismaClient({ adapter });
    return prismaInstance;
}
