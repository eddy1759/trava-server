import { prisma } from '../../services/prisma';
import { generateEmbeddings } from '../../services/embedding.service';
import ApiError from '../../utils/ApiError';
import { JournalEntry, Prisma, JournalStatus, Photo } from '@prisma/client';
import { contentModerationQueue, notificationQueue } from '../jobs/queue';
import logger from '../../utils/logger';


async function createJournalEntry(data: {
  tripId: string;
  title: string;
  date: Date;
  content: string;
  photos?: string[];
  isPublic?: boolean;
}, userId: string): Promise<JournalEntry> {
    // verify the trip belongs to the user
    const trip = await prisma.trip.findUnique({
        where: { id: data.tripId },
    });

    if (!trip || trip.ownerId !== userId) throw ApiError.Forbidden('Access denied: Trip does not belong to the user.');

    // Generate embedding for RAG
    const [embedding] = await generateEmbeddings([data.content]);
    const embeddingString = `[${embedding.join(',')}]`;

    const entry = await prisma.$transaction(async (tx) => {
    // Step 1: Create the entry with all data except the embedding.
        const newEntry = await tx.journalEntry.create({
            data: {
                tripId: data.tripId,
                userId: userId,
                title: data.title,
                content: data.content,
                date: data.date, // FIX: Use the validated date from input.
                isPublic: data.isPublic ?? false,
                journalStatus: JournalStatus.PENDING, // Explicitly set status
                photos: data.photos && data.photos.length > 0
                    ? { create: data.photos.map(url => ({ url })) }
                    : undefined,
            },
            include: {
                photos: true,
            },
        });

        await tx.$executeRaw`UPDATE "JournalEntry" SET embedding = ${embeddingString}::vector WHERE id = ${newEntry.id}`;

        return newEntry;
    });

    if (!entry) throw ApiError.InternalServerError('Failed to create journal entry');

    try {
            await contentModerationQueue.add('moderate-journal-entry', {
                contentId: entry.id,
                userId,
                content: data.content,
                contentType: 'journal_entry'
            });
            logger.info(`Journal entry ${entry.id} queued for content moderation`);
    } catch (error) {
        logger.error(`Failed to queue journal entry ${entry.id} for moderation:`, error);
    }

    return entry;
}

async function getJournalEntryById(id: string, userId: string): Promise<JournalEntry | null> {
    const entry = await prisma.journalEntry.findUnique({
        where: { id },
        include: { photos: true },
    });
    if (!entry) throw ApiError.NotFound('Journal entry not found');

    // FIX: Add check for collaborators if that feature exists. For now, owner check is fine.
    if (!entry.isPublic && entry.userId !== userId) {
        throw ApiError.Forbidden('Access denied');
    }
    return entry;
}

async function updateJournalEntry(
    id: string,
    userId: string,
    data: Partial<Pick<JournalEntry, 'title' | 'content' | 'date' | 'isPublic'>> & { photos?: string[] }
): Promise<JournalEntry> {
    // First, verify ownership.
    const existingEntry = await prisma.journalEntry.findUnique({ where: { id } });
    if (!existingEntry) throw ApiError.NotFound('Journal entry not found');
    if (existingEntry.userId !== userId) throw ApiError.Forbidden('Access denied');

    return prisma.$transaction(async (tx) => {
        const { content, photos, ...otherFields } = data;
        let statusUpdate: { status?: JournalStatus } = {};

        // If content is updated, generate new embedding and reset moderation status
        if (content) {
            const [embedding] = await generateEmbeddings([content]);
            const embeddingString = `[${embedding.join(',')}]`;
            await tx.$executeRaw`
                UPDATE "JournalEntry" 
                SET embedding = ${embeddingString}::vector, status = 'PENDING' 
                WHERE id = ${id};
            `;
            statusUpdate.status = 'PENDING'; // Ensure Prisma knows about the status change
        }

        // Update other fields using the typed client
        const updatedEntry = await tx.journalEntry.update({
            where: { id },
            data: {
                ...otherFields,
                content: content, // Update content if provided
                photos: photos
                    ? {
                        deleteMany: {}, // This replaces all photos, which is what the original code did.
                        create: photos.map(url => ({ url })),
                      }
                    : undefined,
                // The status is updated via raw query if content changes, but we ensure it's not overwritten here.
            },
            include: { photos: true },
        });

        // Queue moderation job outside the transaction if content was changed
        if (content) {
             try {
                await contentModerationQueue.add('moderate-journal-entry', {
                    contentId: id, userId, content, contentType: 'journal_entry'
                });
                logger.info(`Updated journal entry ${id} queued for content moderation`);
            } catch (error) {
                logger.error(`Failed to queue updated journal entry ${id} for moderation:`, error);
            }
        }
        
        return updatedEntry;
    });
}

async function deleteJournalEntry(id: string, userId: string): Promise<void> {
   const result = await prisma.journalEntry.deleteMany({
    where: {
      id: id,
      userId: userId, 
    },
  });

  // If no rows were deleted, the entry either didn't exist or the user didn't have access
  if (result.count === 0) {
    throw ApiError.NotFound('Journal entry not found or access denied.');
  }
}

async function listJournalEntries(params: {
    userId?: string;      // Filter by the author of the journal
    isPublic?: boolean;
    search?: string;      // Optional semantic search query
    skip?: number;
    take?: number;
    viewerId?: string;
}): Promise<JournalEntry[]> {
    try {
        const { userId, isPublic, search, skip = 0, take = 20, viewerId } = params;
        
        if (search) {
            logger.info(`Performing semantic search for viewer: ${viewerId || 'guest'}`);

            // Generate the embedding for the search query
            const [queryEmbedding] = await generateEmbeddings([search]);
            if (!queryEmbedding) {
                throw ApiError.BadRequest('Failed to generate embedding for search query');
            }

            const SIMILARITY_THRESHOLD = 0.75;
           
            // For semantic search, we typically want to search across all content, not just a specific trip
            // So we'll ignore tripId for semantic search but still apply other filters
            const whereClauses: Prisma.Sql[] = [Prisma.sql`"journalStatus" = 'APPROVED'`];
            
            // Don't filter by tripId for semantic search - we want the best matches regardless of trip
            // whereClauses.push(Prisma.sql`(embedding <-> ${queryEmbedding}::vector) < ${SIMILARITY_THRESHOLD}`);

            const hybridSearchCondition = Prisma.sql`(
                ("embedding" <-> ${queryEmbedding}::vector) < ${SIMILARITY_THRESHOLD} 
                OR 
                "title" ILIKE ${'%' + search + '%'}
            )`;
            whereClauses.push(hybridSearchCondition);

            if (userId) whereClauses.push(Prisma.sql`"userId" = ${userId}`);
            if (typeof isPublic === 'boolean') whereClauses.push(Prisma.sql`"isPublic" = ${isPublic}`);

            // Authorization filter: what is the viewer allowed to see?
            if (viewerId) {
                // Authenticated user: Can see public entries OR their own private ones
                whereClauses.push(Prisma.sql`("isPublic" = TRUE OR "userId" = ${viewerId})`);
            } else {
                // Unauthenticated user: Can only see public entries
                whereClauses.push(Prisma.sql`"isPublic" = TRUE`);
            }
            
            // Combine all where clauses into a single SQL condition
            const whereCondition = Prisma.join(whereClauses, ' AND ');
            const entries = await prisma.$queryRaw<JournalEntry[]>(
                Prisma.sql`
                    SELECT id, title, content, date, "tripId", "userId", "isPublic", "journalStatus", "moderationReason"
                    FROM "JournalEntry"
                    WHERE ${whereCondition}
                    -- ORDER BY embedding <-> ${queryEmbedding}::vector
                    ORDER BY 
                        CASE WHEN "title" ILIKE ${'%' + search + '%'} THEN 0 ELSE 1 END,
                        "embedding" <-> ${queryEmbedding}::vector
                    LIMIT ${take}
                    OFFSET ${skip}
                `
            );
            
            // Fetch and attach related photos (since $queryRaw doesn't support include)
            if (entries.length === 0) {
                return [];
            }

            const entryIds = entries.map(entry => entry.id);
            const photos = await prisma.photo.findMany({
                where: {
                    journalEntryId: {
                        in: entryIds
                    }
                }
            });

            const photoMap = new Map<string, Photo[]>();
            for (const photo of photos) {
                if (!photoMap.has(photo.journalEntryId)) {
                    photoMap.set(photo.journalEntryId, []);
                }
                photoMap.get(photo.journalEntryId)!.push(photo);
            }

            return entries.map(entry => ({
                ...entry,
                photos: photoMap.get(entry.id) || []
            }));

        } else {
            // For non-semantic search, apply all filters including tripId
            const whereClauses: Prisma.Sql[] = [Prisma.sql`"journalStatus" = 'APPROVED'`];

            if (userId) whereClauses.push(Prisma.sql`"userId" = ${userId}`);
            if (typeof isPublic === 'boolean') whereClauses.push(Prisma.sql`"isPublic" = ${isPublic}`);

            // Authorization filter: what is the viewer allowed to see?
            if (viewerId) {
                // Authenticated user: Can see public entries OR their own private ones
                whereClauses.push(Prisma.sql`("isPublic" = TRUE OR "userId" = ${viewerId})`);
            } else {
                // Unauthenticated user: Can only see public entries
                whereClauses.push(Prisma.sql`"isPublic" = TRUE`);
            }

            logger.info(`Performing standard search for viewer: ${viewerId || 'guest'}`);
            return prisma.journalEntry.findMany({
                where: {
                    AND: [
                        { journalStatus: JournalStatus.APPROVED },
                        userId ? { userId } : {},
                        typeof isPublic === 'boolean' ? { isPublic } : {},
                        // Authorization: Viewer can see public entries or their own private ones
                        viewerId ? { OR: [{ isPublic: true }, { userId: viewerId }] } : { isPublic: true },
                    ],
                },
                skip,
                take,
                orderBy: { date: 'desc' },
                include: { photos: true },
            });
        }
        
    } catch (error) {
        logger.error('Error listing journal entries:', error);
        throw ApiError.InternalServerError('Failed to list journal entries');
    }
}


// async function listJournalEntries(params: {
//     tripId?: string;
//     userId?: string;      // Filter by the author of the journal
//     isPublic?: boolean;
//     search?: string;      // Optional semantic search query
//     skip?: number;
//     take?: number;
//     viewerId?: string;
// }): Promise<JournalEntry[]> {
//     try {
//         const { tripId, userId, isPublic, search, skip = 0, take = 20, viewerId } = params;
//         const whereClauses: Prisma.Sql[] = [Prisma.sql`"journalStatus" = 'APPROVED'`];

//         if (tripId) whereClauses.push(Prisma.sql`"tripId" = ${tripId}`);
//         if (userId) whereClauses.push(Prisma.sql`"userId" = ${userId}`);
//         if (typeof isPublic === 'boolean') whereClauses.push(Prisma.sql`"isPublic" = ${isPublic}`);

//         // Authorization filter: what is the viewer allowed to see?
//         if (viewerId) {
//             // Authenticated user: Can see public entries OR their own private ones
//             whereClauses.push(Prisma.sql`("isPublic" = TRUE OR "userId" = ${viewerId})`);
//         } else {
//             // Unauthenticated user: Can only see public entries
//             whereClauses.push(Prisma.sql`"isPublic" = TRUE`);
//         }

//         if (search) {
//             logger.info(`Performing semantic search for viewer: ${viewerId || 'guest'}`);

//             // Generate the embedding for the search query
//             const [queryEmbedding] = await generateEmbeddings([search]);
//             if (!queryEmbedding) {
//                 throw ApiError.BadRequest('Failed to generate embedding for search query');
//             }
           
            
//             // Combine all where clauses into a single SQL condition
//             const whereCondition = Prisma.join(whereClauses, ' AND ');
//             const entries = await prisma.$queryRaw<JournalEntry[]>(
//                 Prisma.sql`
//                     SELECT id, title, content, date, "tripId", "userId", "isPublic", "journalStatus", "moderationReason"
//                     FROM "JournalEntry"
//                     WHERE ${whereCondition}
//                     ORDER BY embedding <-> ${queryEmbedding}::vector
//                     LIMIT ${take}
//                     OFFSET ${skip}
//                 `
//             );
            
//             // Fetch and attach related photos (since $queryRaw doesn't support include)
//             if (entries.length === 0) {
//                 return [];
//             }

//             const entryIds = entries.map(entry => entry.id);
//             const photos = await prisma.photo.findMany({
//                 where: {
//                     journalEntryId: {
//                         in: entryIds
//                     }
//                 }
//             });

//             const photoMap = new Map<string, Photo[]>();
//             for (const photo of photos) {
//                 if (!photoMap.has(photo.journalEntryId)) {
//                     photoMap.set(photo.journalEntryId, []);
//                 }
//                 photoMap.get(photo.journalEntryId)!.push(photo);
//             }

//             return entries.map(entry => ({
//                 ...entry,
//                 photos: photoMap.get(entry.id) || []
//             }));

//         } else { // <<< FIX: Wrap the standard search in an 'else' block
//             logger.info(`Performing standard search for viewer: ${viewerId || 'guest'}`);
//             return prisma.journalEntry.findMany({
//                 where: {
//                     AND: [
//                         { journalStatus: JournalStatus.APPROVED },
//                         tripId ? { tripId } : {},
//                         userId ? { userId } : {},
//                         typeof isPublic === 'boolean' ? { isPublic } : {},
//                         // Authorization: Viewer can see public entries or their own private ones
//                         viewerId ? { OR: [{ isPublic: true }, { userId: viewerId }] } : { isPublic: true },
//                     ],
//                 },
//                 skip,
//                 take,
//                 orderBy: { date: 'desc' },
//                 include: { photos: true },
//             });
//         }
        
        
//     } catch (error) {
//         logger.error('Error listing journal entries:', error);
//         throw ApiError.InternalServerError('Failed to list journal entries');
//     }
// }


export const journalEntryService = {
    createJournalEntry,
    getJournalEntryById,
    updateJournalEntry,
    deleteJournalEntry,
    listJournalEntries
};