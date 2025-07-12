import { GoogleGenerativeAI, TaskType  } from '@google/generative-ai';
import logger from '../utils/logger';
import CONFIG from '../config/env';

const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'text-embedding-004' }); // Use a dedicated embedding model

/**
 * Generates vector embeddings for a batch of text documents.
 * @param texts An array of strings to be embedded.
 * @returns A promise that resolves to an array of number arrays (embeddings).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
        const result = await model.batchEmbedContents({
            requests: texts.map(text => ({
                content: { role: "user", parts: [{ text }] },
                taskType: TaskType.RETRIEVAL_DOCUMENT
            })),
        });
        // 🔍 DEBUG: Check actual dimensions
        if (result.embeddings && result.embeddings.length > 0) {
            console.log('✅ Embedding dimensions:', result.embeddings[0].values.length);
        }

        return result.embeddings.map(e => e.values);
    } catch (error) {
        logger.error('Failed to generate embeddings:', error);
        throw new Error('Embedding generation failed.');
    }
}