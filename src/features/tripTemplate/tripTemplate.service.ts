import { prisma } from '../../services/prisma';
import { generateEmbeddings } from '../../services/embedding.service';
import ApiError from '../../utils/ApiError';
import { TripTemplate, Prisma } from '@prisma/client';

export interface tripTemplateData {
    name: string,
    description: string,
    durationInDays: number,
    destinationId: string,
    templateItems: any[]
}
export class TripTemplateService {
  static async createTripTemplate(
    data: tripTemplateData
): Promise<TripTemplate> {
    // Generate embedding for semantic search
    const [embedding] = await generateEmbeddings([
      `${data.name}. ${data.description}`
    ]);
    const embeddingString = `[${embedding.join(',')}]`;
    // Insert using raw SQL for embedding
    const result = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "TripTemplate" (
        name, description, "durationInDays", "destinationId", "templateItems", embedding
      ) VALUES (
        ${data.name}, ${data.description}, ${data.durationInDays}, ${data.destinationId}, ${JSON.stringify(data.templateItems)}, ${embeddingString}::vector
      ) RETURNING id;
    `;
    const id = result[0]?.id;
    if (!id) throw ApiError.InternalServerError('Failed to create trip template');
    return prisma.tripTemplate.findUniqueOrThrow({ where: { id } });
  }

  static async getTripTemplateById(id: string): Promise<TripTemplate> {
    const template = await prisma.tripTemplate.findUnique({ where: { id } });
    if (!template) throw ApiError.NotFound('Trip template not found');
    return template;
  }

  static async updateTripTemplate(id: string, data: Partial<TripTemplate> & { templateItems?: any[] }): Promise<TripTemplate> {
    // If name/description changes, update embedding
    let embedding;
    if (data.name || data.description) {
      const template = await prisma.tripTemplate.findUnique({ where: { id } });
      if (!template) throw ApiError.NotFound('Trip template not found');
      const [newEmbedding] = await generateEmbeddings([
        `${data.name ?? template.name}. ${data.description ?? template.description}`
      ]);
      embedding = `[${newEmbedding.join(',')}]`;
      await prisma.$executeRaw`
        UPDATE "TripTemplate"
        SET embedding = ${embedding}::vector
        WHERE id = ${id};
      `;
    }
    return prisma.tripTemplate.update({
      where: { id },
      data: {
        ...data,
        templateItems: data.templateItems ? (data.templateItems as any) : undefined,
      },
    });
  }

  static async deleteTripTemplate(id: string): Promise<void> {
    await prisma.tripTemplate.delete({ where: { id } });
  }

  static async listTripTemplates(params: {
    destinationId?: string;
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<TripTemplate[]> {
    const { destinationId, search, skip = 0, take = 20 } = params;
    let where: Prisma.TripTemplateWhereInput = {};
    if (destinationId) where.destinationId = destinationId;
    if (search) {
      // Semantic search using embedding
      const [queryEmbedding] = await generateEmbeddings([search]);
      const templates = await prisma.$queryRawUnsafe(
        `SELECT * FROM "TripTemplate"
         WHERE (embedding <#> $1) < 0.5
         ORDER BY embedding <#> $1
         LIMIT $2 OFFSET $3`,
        queryEmbedding,
        take,
        skip
      ) as TripTemplate[];
      return templates;
    }
    return prisma.tripTemplate.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
    });
  }
} 