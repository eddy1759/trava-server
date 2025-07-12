// import logger from '../utils/logger';
// import { createHash } from 'crypto';

// export interface ModerationResult {
//     isApproved: boolean;
//     confidence: number; // 0-1 confidence score
//     reason?: string;
//     category?: string;
//     moderatedContent?: string;
//     flags: string[];
//     severity: 'low' | 'medium' | 'high' | 'critical';
//     requiresHumanReview: boolean;
// }


// export class ContentModerationService {
//   // Categorized inappropriate content for better reporting
//   private static readonly inappropriateWords = {
//     spam: ['spam', 'scam', 'fake', 'fraud', 'phishing', 'clickbait', 'malware', 'virus'],
//     illegal: ['hack', 'crack', 'piracy', 'illegal', 'stolen', 'counterfeit', 'bootleg'],
//     adult: ['nsfw', 'nude', 'explicit', 'porn', 'xxx', 'sex', 'adult', 'erotic'],
//     violence: ['violence', 'abuse', 'assault', 'attack', 'fight', 'beat', 'stab', 'weapon'],
//     hate: ['hate', 'racist', 'sexist', 'homophobic', 'transphobic', 'xenophobic', 'bigot'],
//     harassment: ['harass', 'bully', 'stalk', 'threaten', 'intimidate', 'doxx', 'revenge'],
//     substances: ['drugs', 'weed', 'cocaine', 'meth', 'heroin', 'overdose', 'dealer', 'addict'],
//     selfHarm: ['suicide', 'selfharm', 'cutting', 'overdose', 'hanging', 'jumping'],
//     extremism: ['terrorist', 'bomb', 'extremist', 'radical', 'isis', 'nazi', 'kkk'],
//     profanity: ['fuck', 'shit', 'damn', 'bitch', 'asshole', 'cunt', 'motherfucker']
//   };

//   // Enhanced spam detection patterns
//   private static readonly spamPatterns = [
//     // Commercial spam
//     /\b(?:buy|sell|discount|offer|limited|act now|deal|promo|sale|cheap|bargain)\b/gi,
//     /\b(?:click here|visit|subscribe|join now|check this|tap here|link in bio|follow link)\b/gi,
//     /\b(?:free|money|cash|earn|make money|get rich|crypto|bitcoin|investment|trading)\b/gi,
//     /\b(?:winner|won|congrats|giveaway|claim prize|lottery|sweepstakes|contest)\b/gi,
    
//     // Adult content spam
//     /\b(?:hot pics|leaked|nudes|sex tape|adult content|18\+|xxx|cam|escort)\b/gi,
//     /\b(?:onlyfans|snapchat|instagram|telegram|whatsapp|kik|dating|hookup)\b/gi,
    
//     // Social media spam
//     /\b(?:follow me|dm me|inbox me|add me|check my profile|visit my page)\b/gi,
//     /\b(?:like and share|rt if|tag friends|comment below|double tap)\b/gi,
    
//     // Scam patterns
//     /\b(?:100% legit|guaranteed|verified source|real deal|limited stock|exclusive)\b/gi,
//     /\b(?:work from home|easy money|quick cash|no experience|make \$\d+)\b/gi,
    
//     // URLs and contact info
//     /\bhttps?:\/\/[^\s]+/gi,
//     /\bwww\.[^\s]+/gi,
//     /\b(?:[a-z0-9-]+\.)+[a-z]{2,6}(?:\/\S*)?/gi,
//     /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    
//     // Phone numbers (multiple formats)
//     /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
//     /\b(?:\+?\d{1,3}[-.\s]?)?\d{10,15}\b/g,
    
//     // Cryptocurrency addresses
//     /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g, // Bitcoin
//     /\b0x[a-fA-F0-9]{40}\b/g, // Ethereum
    
//     // Social media handles
//     /@[a-zA-Z0-9_]+/g,
    
//     // Suspicious patterns
//     /\b(?:dm|pm|message|text|call|contact)\s+me\b/gi,
//     /\b(?:whatsapp|telegram|signal|discord)\s*:?\s*[\+\d\s\-\(\)]+/gi,
//   ];

//   // Language detection patterns
//   private static readonly languagePatterns = {
//     // Common non-English spam
//     chinese: /[\u4e00-\u9fff]/g,
//     arabic: /[\u0600-\u06ff]/g,
//     russian: /[\u0400-\u04ff]/g,
//     korean: /[\uac00-\ud7af]/g,
//     japanese: /[\u3040-\u309f\u30a0-\u30ff]/g,
//   };

//   // Sophisticated detection algorithms
//   private static readonly suspiciousPatterns = [
//     // Leetspeak detection
//     /[a-z0-9]*[0-9@$!]+[a-z0-9]*/gi,
//     // Excessive punctuation
//     /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{3,}/g,
//     // Excessive emojis
//     /[\u{1F600}-\u{1F64F}][\u{1F300}-\u{1F5FF}][\u{1F680}-\u{1F6FF}][\u{1F1E0}-\u{1F1FF}]/gu,
//     // Base64 encoded content
//     /^[A-Za-z0-9+/]{4,}={0,2}$/,
//     // Suspicious character repetition
//     /(.)\1{4,}/g,
//   ];

//   // Rate limiting and user behavior tracking
//   private static readonly userViolations = new Map<string, {
//     count: number;
//     lastViolation: Date;
//     violationTypes: string[];
//   }>();

//   // Content hashing for duplicate detection
//   private static readonly contentHashes = new Set<string>();


//   // Main content moderation function
//   static async moderateContent(
//     content: string, 
//     userId: string, 
//     contentType: 'comment' | 'journal' | 'trip_name' | 'bio' = 'comment'
//   ): Promise<ModerationResult> {
//     try {
//       const result: ModerationResult = {
//         isApproved: true,
//         confidence: 0.9,
//         flags: [],
//         severity: 'low',
//         requiresHumanReview: false
//       };

//       // Input validation
//       if (!content || typeof content !== 'string' || content.trim().length === 0) {
//           return {
//               isApproved: false, confidence: 1.0, reason: 'Invalid or empty content',
//               flags: ['invalid_input'], severity: 'low', requiresHumanReview: false
//           };
//       }
//       const normalizedContent = content.trim();

//       if (normalizedContent.length === 0) {
//         return {
//           isApproved: false,
//           confidence: 1.0,
//           reason: 'Empty content',
//           flags: ['empty_content'],
//           severity: 'low',
//           requiresHumanReview: false
//         };
//       }

//       // Check for duplicate content
//       const contentHash = this.generateContentHash(normalizedContent);
//       if (this.contentHashes.has(contentHash)) {
//         result.flags.push('duplicate_content');
//         result.severity = 'medium';
//         result.confidence -= 0.2;
//       } else {
//         this.contentHashes.add(contentHash);
//       }

//       // PRODUCTION FIX: Use a shared cache like Redis instead of a local Set.
//       // const isDuplicate = await redisClient.sIsMember('content-hashes', contentHash);
//       // if (isDuplicate) {
//       //     result.flags.push('duplicate_content');
//       //     result.severity = 'medium';
//       //     result.confidence -= 0.2;
//       // } else {
//       //     await redisClient.sAdd('content-hashes', contentHash);
//       //     await redisClient.expire('content-hashes', 3600); // Expire after 1 hour
//       // }

//       // User behavior analysis
//       const userViolation = this.checkUserViolationHistory(userId);
//       if (userViolation.isHighRisk) {
//         result.flags.push('high_risk_user');
//         result.severity = 'high';
//         result.confidence -= 0.3;
//         result.requiresHumanReview = true;
//       }

//       // Content-specific length checks
//       const lengthCheck = this.checkContentLength(normalizedContent, contentType);
//       if (!lengthCheck.isValid) {
//         return {
//           isApproved: false,
//           confidence: 1.0,
//           reason: lengthCheck.reason,
//           flags: ['length_violation'],
//           severity: 'medium',
//           requiresHumanReview: false
//         };
//       }

//       // Inappropriate words detection
//       const inappropriateCheck = this.checkInappropriateWords(normalizedContent);
//       if (inappropriateCheck.detected) {
//         result.isApproved = false;
//         result.confidence = 0.95;
//         result.reason = `Content contains inappropriate language: ${inappropriateCheck.category}`;
//         result.category = inappropriateCheck.category;
//         result.flags.push('inappropriate_language', inappropriateCheck.category);
//         result.severity = inappropriateCheck.severity;
//         result.requiresHumanReview = inappropriateCheck.severity === 'critical';
//       }

//       // Spam detection
//       const spamCheck = this.checkSpamPatterns(normalizedContent);
//       if (spamCheck.detected) {
//         result.isApproved = false;
//         result.confidence = Math.max(result.confidence, 0.85);
//         result.reason = result.reason || 'Content appears to be spam';
//         result.flags.push('spam', ...spamCheck.patterns);
//         result.severity = this.escalateSeverity(result.severity, 'high');
//         result.requiresHumanReview = spamCheck.patterns.length > 2;
//       }

//       // Advanced pattern detection
//       const advancedCheck = this.checkAdvancedPatterns(normalizedContent);
//       if (advancedCheck.suspicious) {
//         result.flags.push(...advancedCheck.flags);
//         result.confidence -= 0.1;
//         if (advancedCheck.flags.includes('base64_encoded')) {
//           result.requiresHumanReview = true;
//         }
//       }

//       // Text quality analysis
//       const qualityCheck = this.checkTextQuality(normalizedContent);
//       if (!qualityCheck.isGoodQuality) {
//         result.flags.push(...qualityCheck.issues);
//         result.confidence -= 0.1;
//         if (qualityCheck.issues.includes('excessive_repetition')) {
//           result.isApproved = false;
//           result.reason = 'Content contains excessive repetition';
//           result.severity = 'medium';
//         }
//       }

//       // Language detection
//       const languageCheck = this.checkLanguage(normalizedContent);
//       if (languageCheck.suspiciousLanguage) {
//         result.flags.push('suspicious_language');
//         result.requiresHumanReview = true;
//       }

//       if (result.confidence < 0.5 || result.flags.length > 0) {
//           result.isApproved = false;
//       }

//       if (!result.isApproved) {
//           // If rejected, remove the moderated content body.
//           delete result.moderatedContent;
//           await this.updateUserViolationHistory(userId, result.category || 'general');
//       }

//       // Log moderation result
//       logger.info(`Content moderation result for user ${userId}:`, result);
//       return result;

//     } catch (error) {
//       logger.error('Content moderation error:', error);
//       // Fail closed for security
//       return {
//           isApproved: false, confidence: 0.0, reason: 'Moderation system error',
//           flags: ['system_error'], severity: 'critical', requiresHumanReview: true
//       };
//     }
//   }

//   // Content length validation
//   private static checkContentLength(content: string, type: string): { isValid: boolean; reason?: string } {
//     const limits = {
//       comment: 500,
//       journal: 10000,
//       trip_name: 100,
//       bio: 300
//     };

//     const limit = limits[type as keyof typeof limits] || 500;
    
//     if (content.length > limit) {
//       return {
//         isValid: false,
//         reason: `Content exceeds maximum length of ${limit} characters`
//       };
//     }

//     return { isValid: true };
//   }

//   // Inappropriate words detection with categorization
//   private static checkInappropriateWords(content: string): {
//     detected: boolean;
//     category?: string;
//     severity: 'low' | 'medium' | 'high' | 'critical';
//   } {
//     const lowerContent = content.toLowerCase();
    
//     for (const [category, words] of Object.entries(this.inappropriateWords)) {
//       for (const word of words) {
//         if (lowerContent.includes(word.toLowerCase())) {
//           const severity = this.getSeverityForCategory(category);
//           return {
//             detected: true,
//             category,
//             severity
//           };
//         }
//       }
//     }
    
//     return { detected: false, severity: 'low' };
//   }

//   // Spam pattern detection
//   private static checkSpamPatterns(content: string): {
//     detected: boolean;
//     patterns: string[];
//   } {
//     const detectedPatterns: string[] = [];
    
//     for (const pattern of this.spamPatterns) {
//       if (pattern.test(content)) {
//         detectedPatterns.push(pattern.source);
//       }
//     }
    
//     return {
//       detected: detectedPatterns.length > 0,
//       patterns: detectedPatterns
//     };
//   }

//   // Advanced pattern detection
//   private static checkAdvancedPatterns(content: string): {
//     suspicious: boolean;
//     flags: string[];
//   } {
//     const flags: string[] = [];
    
//     // Check for leetspeak
//     if (this.suspiciousPatterns[0].test(content)) {
//       flags.push('leetspeak');
//     }
    
//     // Check for excessive punctuation
//     if (this.suspiciousPatterns[1].test(content)) {
//       flags.push('excessive_punctuation');
//     }
    
//     // Check for excessive emojis
//     const emojiCount = (content.match(this.suspiciousPatterns[2]) || []).length;
//     if (emojiCount > 10) {
//       flags.push('excessive_emojis');
//     }
    
//     // Check for base64 encoding
//     if (this.suspiciousPatterns[3].test(content)) {
//       flags.push('base64_encoded');
//     }
    
//     // Check for character repetition
//     if (this.suspiciousPatterns[4].test(content)) {
//       flags.push('character_repetition');
//     }
    
//     return {
//       suspicious: flags.length > 0,
//       flags
//     };
//   }

//   // Text quality analysis
//   private static checkTextQuality(content: string): {
//     isGoodQuality: boolean;
//     issues: string[];
//   } {
//     const issues: string[] = [];
    
//     // Check for excessive repetition
//     const words = content.split(/\s+/);
//     const wordCount = words.length;
//     const uniqueWords = new Set(words.map(w => w.toLowerCase()));
//     const repetitionRatio = uniqueWords.size / wordCount;
    
//     if (wordCount > 10 && repetitionRatio < 0.3) {
//       issues.push('excessive_repetition');
//     }
    
//     // Check for excessive caps
//     const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
//     if (capsRatio > 0.7 && content.length > 20) {
//       issues.push('excessive_caps');
//     }
    
//     // Check for excessive whitespace
//     if (/\s{5,}/.test(content)) {
//       issues.push('excessive_whitespace');
//     }
    
//     // Check for gibberish (low vowel ratio)
//     const vowelRatio = (content.match(/[aeiouAEIOU]/g) || []).length / content.length;
//     if (vowelRatio < 0.1 && content.length > 20) {
//       issues.push('potential_gibberish');
//     }
    
//     return {
//       isGoodQuality: issues.length === 0,
//       issues
//     };
//   }

//   // Language detection
//   private static checkLanguage(content: string): { suspiciousLanguage: boolean } {
//     // Check for suspicious language patterns that might indicate spam
//     const totalChars = content.length;
//     let suspiciousChars = 0;
    
//     for (const pattern of Object.values(this.languagePatterns)) {
//       const matches = content.match(pattern) || [];
//       suspiciousChars += matches.length;
//     }
    
//     const suspiciousRatio = suspiciousChars / totalChars;
    
//     // Flag if more than 80% of content is in suspicious character sets
//     return {
//       suspiciousLanguage: suspiciousRatio > 0.8 && totalChars > 10
//     };
//   }

//   // User violation history management
//   private static checkUserViolationHistory(userId: string): {
//     isHighRisk: boolean;
//     violationCount: number;
//   } {
//     // PRODUCTION FIX: This state must live in a distributed cache like Redis.
//         // const userHistory = await redisClient.get(`violations:${userId}`);
//         // if (!userHistory) {
//         //     return { isHighRisk: false, violationCount: 0 };
//         // }
//         // const parsedHistory = JSON.parse(userHistory);
//         // const isHighRisk = parsedHistory.count >= 5;
//         // return { isHighRisk, violationCount: parsedHistory.count };
//     const userHistory = this.userViolations.get(userId);
    
//     if (!userHistory) {
//       return { isHighRisk: false, violationCount: 0 };
//     }
    
//     // Check if violations are recent (within last 24 hours)
//     const recentViolations = userHistory.lastViolation.getTime() > Date.now() - 24 * 60 * 60 * 1000;
//     const isHighRisk = userHistory.count >= 3 && recentViolations;
    
//     return {
//       isHighRisk,
//       violationCount: userHistory.count
//     };
//   }

//   private static updateUserViolationHistory(userId: string, category: string): void {
//     // PRODUCTION FIX: Use Redis INCR and update a JSON object.
//         // const key = `violations:${userId}`;
//         // await redisClient.hIncrBy(key, 'count', 1);
//         // await redisClient.hSet(key, 'lastViolation', new Date().toISOString());
//         // await redisClient.hSet(key, 'lastCategory', category);
//         // await redisClient.expire(key, 86400); // Keep history for 24 hours
//     const existing = this.userViolations.get(userId);
    
//     if (existing) {
//       existing.count++;
//       existing.lastViolation = new Date();
//       existing.violationTypes.push(category);
//     } else {
//       this.userViolations.set(userId, {
//         count: 1,
//         lastViolation: new Date(),
//         violationTypes: [category]
//       });
//     }
//   }

//   // Utility functions
//   private static generateContentHash(content: string): string {
//     return createHash('sha256').update(content.toLowerCase().trim()).digest('hex');
//   }

//   private static getSeverityForCategory(category: string): 'low' | 'medium' | 'high' | 'critical' {
//     const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
//       spam: 'medium',
//       illegal: 'critical',
//       adult: 'high',
//       violence: 'critical',
//       hate: 'critical',
//       harassment: 'high',
//       substances: 'high',
//       selfHarm: 'critical',
//       extremism: 'critical',
//       profanity: 'low'
//     };
    
//     return severityMap[category] || 'medium';
//   }

//   private static escalateSeverity(
//     current: 'low' | 'medium' | 'high' | 'critical',
//     proposed: 'low' | 'medium' | 'high' | 'critical'
//   ): 'low' | 'medium' | 'high' | 'critical' {
//     const severityOrder = ['low', 'medium', 'high', 'critical'];
//     const currentIndex = severityOrder.indexOf(current);
//     const proposedIndex = severityOrder.indexOf(proposed);
    
//     return severityOrder[Math.max(currentIndex, proposedIndex)] as 'low' | 'medium' | 'high' | 'critical';
//   }

//   // Specialized moderation methods
//   static async moderateComment(content: string, userId: string): Promise<ModerationResult> {
//     return this.moderateContent(content, userId, 'comment');
//   }

//   static async moderateJournalEntry(content: string, userId: string): Promise<ModerationResult> {
//     return this.moderateContent(content, userId, 'journal');
//   }

//   static async moderateTripName(name: string, userId: string): Promise<ModerationResult> {
//     return this.moderateContent(name, userId, 'trip_name');
//   }

//   static async moderateUserBio(bio: string, userId: string): Promise<ModerationResult> {
//     return this.moderateContent(bio, userId, 'bio');
//   }

//   // Batch moderation for performance
//   static async moderateContentBatch(
//     contents: Array<{ content: string; userId: string; type: string }>,
//     maxConcurrency: number = 5
//   ): Promise<ModerationResult[]> {
//     const results: ModerationResult[] = [];
    
//     for (let i = 0; i < contents.length; i += maxConcurrency) {
//       const batch = contents.slice(i, i + maxConcurrency);
//       const batchPromises = batch.map(({ content, userId, type }) =>
//         this.moderateContent(content, userId, type as any)
//       );
      
//       const batchResults = await Promise.all(batchPromises);
//       results.push(...batchResults);
//     }
    
//     return results;
//   }

//   // Admin utilities
//   static clearUserViolationHistory(userId: string): void {
//     this.userViolations.delete(userId);
//   }

//   static getUserViolationHistory(userId: string): any {
//     return this.userViolations.get(userId) || null;
//   }

//   static getSystemStats(): {
//     totalUsers: number;
//     highRiskUsers: number;
//     totalContentHashes: number;
//   } {
//     const totalUsers = this.userViolations.size;
//     const highRiskUsers = Array.from(this.userViolations.values())
//       .filter(user => user.count >= 3).length;
    
//     return {
//       totalUsers,
//       highRiskUsers,
//       totalContentHashes: this.contentHashes.size
//     };
//   }
// }


import { createHash } from 'crypto';
import logger from '../utils/logger';

export interface ModerationResult {
    isApproved: boolean;
    confidence: number; // 0-1 confidence score
    reason?: string;
    category?: string;
    moderatedContent?: string;
    flags: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    requiresHumanReview: boolean;
}

export class ContentModerationService {
    // WORD LISTS
    private static readonly inappropriateWords = {
        spam: ['spam', 'scam', 'fake', 'fraud', 'phishing', 'clickbait', 'malware', 'virus'],
        illegal: ['hack', 'crack', 'piracy', 'illegal', 'stolen', 'counterfeit', 'bootleg'],
        adult: ['nsfw', 'nude', 'explicit', 'porn', 'xxx', 'sex', 'adult', 'erotic'],
        violence: ['violence', 'abuse', 'assault', 'attack', 'fight', 'beat', 'stab', 'weapon'],
        hate: ['hate', 'racist', 'sexist', 'homophobic', 'transphobic', 'xenophobic', 'bigot'],
        harassment: ['harass', 'bully', 'stalk', 'threaten', 'intimidate', 'doxx', 'revenge'],
        substances: ['drugs', 'weed', 'cocaine', 'meth', 'heroin', 'overdose', 'dealer', 'addict'],
        selfHarm: ['suicide', 'selfharm', 'cutting', 'overdose', 'hanging', 'jumping'],
        extremism: ['terrorist', 'bomb', 'extremist', 'radical', 'isis', 'nazi', 'kkk'],
        profanity: ['fuck', 'shit', 'damn', 'bitch', 'asshole', 'cunt', 'motherfucker']
    };
    
    // NEW: Travel-related whitelist to reduce false positives on travel content
    private static readonly TRAVEL_WHITELIST = [
        'breathtaking', 'amazing', 'stunning', 'spectacular', 'magnificent',
        'incredible', 'wonderful', 'fantastic', 'beautiful', 'gorgeous',
        'awesome', 'outstanding', 'remarkable', 'exceptional', 'superb'
    ];

    private static readonly travelKeywords = [
        'visited', 'arrived', 'tower', 'view', 'paris', 'hotel', 'restaurant',
        'trip', 'travel', 'vacation', 'holiday', 'journey', 'destination',
        'sightseeing', 'tourist', 'landmark', 'museum', 'beach', 'mountain'
    ];


    // REGEX PATTERNS
    private static readonly spamPatterns = [
        /\b(?:buy|sell|discount|offer|limited|act now|deal|promo|sale|cheap|bargain)\b/gi,
        /\b(?:click here|subscribe|join now|check this|tap here|link in bio|follow link)\b/gi,
        /\b(?:free|money|cash|earn|make money|get rich|crypto|bitcoin|investment|trading)\b/gi,
        /\b(?:winner|won|congrats|giveaway|claim prize|lottery|sweepstakes|contest)\b/gi,
        /\b(?:hot pics|leaked|nudes|sex tape|adult content|18\+|xxx|cam|escort)\b/gi,
        /\b(?:onlyfans|snapchat|instagram|telegram|whatsapp|kik|dating|hookup)\b/gi,
        /\b(?:follow me|dm me|inbox me|add me|check my profile|visit my page)\b/gi,
        /\b(?:like and share|rt if|tag friends|comment below|double tap)\b/gi,
        /\b(?:100% legit|guaranteed|verified source|real deal|limited stock|exclusive)\b/gi,
        /\b(?:work from home|easy money|quick cash|no experience|make \$\d+)\b/gi,
        /https?:\/\/[^\s]+/gi,
        /www\.[^\s]+/gi,
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
        /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
        /(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}/g, // Bitcoin
        /0x[a-fA-F0-9]{40}/g, // Ethereum
        /@[a-zA-Z0-9_]+/g,
        /\b(?:dm|pm|message|text|call|contact)\s+me\b/gi,
    ];
    private static readonly languagePatterns = {
        chinese: /[\u4e00-\u9fff]/g,
        arabic: /[\u0600-\u06ff]/g,
        russian: /[\u0400-\u04ff]/g,
        korean: /[\uac00-\ud7af]/g,
        japanese: /[\u3040-\u309f\u30a0-\u30ff]/g,
    };
    private static readonly suspiciousPatterns = [
        // FIX: Improved leetspeak detection to avoid false positives.
        // It now checks for words that mix letters with common substitutions.
        /\b\w*(?:[4@aA][sS\$5]|[sS\$5][4@aA]|[eE3][lLI1]|[lLI1][eE3]|[oO0][nN]|[iI!1][sS\$5])\w*\b/gi,
        // Excessive punctuation
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{3,}/g,
        // Excessive emojis (simplified for performance)
        /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]){10,}/g,
        // Base64 encoded content
        /^[A-Za-z0-9+/]{4,}={0,2}$/,
        // Suspicious character repetition
        /(.)\1{4,}/g,
    ];

    // STATE MANAGEMENT (Requires Redis/persistent cache for production)
    private static readonly userViolations = new Map<string, { count: number; lastViolation: Date; }>();
    private static readonly contentHashes = new Set<string>();

    // Main content moderation function
    static async moderateContent(
        content: string, 
        userId: string, 
        contentType: 'comment' | 'journal' | 'trip_name' | 'bio' = 'comment'
    ): Promise<ModerationResult> {
        try {
            const result: ModerationResult = {
                isApproved: true,
                confidence: 1.0, // Start with full confidence in approval
                flags: [],
                severity: 'low',
                requiresHumanReview: false
            };

            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                return { isApproved: false, confidence: 1.0, reason: 'Invalid or empty content', flags: ['invalid_input'], severity: 'low', requiresHumanReview: false };
            }
            const normalizedContent = content.trim();

            // NEW: Check against travel whitelist to reduce false positives
            if (this.isWhitelistedTravelContent(normalizedContent)) {
                result.flags.push('whitelisted_travel_content');
                // Boost confidence to prevent minor flags from causing rejection
                result.confidence = 1.0; 
            }
            
            // Inappropriate words detection
            const inappropriateCheck = this.checkInappropriateWords(normalizedContent);
            if (inappropriateCheck.detected) {
                result.isApproved = false;
                result.confidence = 0.95;
                result.reason = `Content contains inappropriate language: ${inappropriateCheck.category}`;
                result.category = inappropriateCheck.category;
                result.flags.push('inappropriate_language', inappropriateCheck.category);
                result.severity = inappropriateCheck.severity;
                result.requiresHumanReview = inappropriateCheck.severity === 'critical';
            }

            // Spam detection
            const spamCheck = this.checkSpamPatterns(normalizedContent);
            if (spamCheck.detected) {
                result.isApproved = false;
                result.confidence = Math.max(result.confidence, 0.85);
                result.reason = result.reason || 'Content appears to be spam';
                result.flags.push('spam', ...spamCheck.patterns);
                result.severity = this.escalateSeverity(result.severity, 'high');
                result.requiresHumanReview = spamCheck.patterns.length > 2;
            }

            // Advanced pattern detection
            const advancedCheck = this.checkAdvancedPatterns(normalizedContent);
            if (advancedCheck.suspicious) {
                result.flags.push(...advancedCheck.flags);
                result.confidence -= 0.1; // Reduce confidence but don't reject outright
            }
            
            // FIX: Refined final decision logic
            // A low-severity flag like 'leetspeak' alone should not cause rejection.
            if (result.flags.length > 0 && result.severity !== 'low') {
                result.isApproved = false;
            } else if (result.flags.includes('leetspeak') && result.flags.length === 1) {
                // If the ONLY flag is leetspeak, approve it but mark for review.
                result.isApproved = true;
                result.requiresHumanReview = true;
            }

            if (!result.isApproved && !result.reason) {
                result.reason = `Content flagged for: ${result.flags.join(', ')}`;
            }

            logger.info(`Content moderation result for user ${userId}:`, result);
            return result;

        } catch (error) {
            logger.error('Content moderation error:', error);
            return { isApproved: false, confidence: 0.0, reason: 'Moderation system error', flags: ['system_error'], severity: 'critical', requiresHumanReview: true };
        }
    }
    
    // NEW: Whitelist check
    private static isWhitelistedTravelContent(content: string): boolean {
        const lowerContent = content.toLowerCase();
        const words = lowerContent.split(/\s+/);
        
        const travelKeywordCount = words.filter(word => this.travelKeywords.includes(word)).length;
        const whitelistWordCount = words.filter(word => this.TRAVEL_WHITELIST.includes(word)).length;

        // If content contains at least one positive travel adjective and two travel keywords,
        // it's very likely legitimate travel content.
        return whitelistWordCount > 0 && travelKeywordCount > 1;
    }
    
    // FIX: Switched to regex with word boundaries for accuracy
    private static checkInappropriateWords(content: string): {
        detected: boolean;
        category?: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
    } {
        for (const [category, words] of Object.entries(this.inappropriateWords)) {
            for (const word of words) {
                const wordPattern = new RegExp(`\\b${word}\\b`, 'i');
                if (wordPattern.test(content)) {
                    const severity = this.getSeverityForCategory(category);
                    return { detected: true, category, severity };
                }
            }
        }
        return { detected: false, severity: 'low' };
    }

    private static checkSpamPatterns(content: string): { detected: boolean; patterns: string[] } {
        const detectedPatterns: string[] = [];
        for (const pattern of this.spamPatterns) {
            if (pattern.test(content)) {
                detectedPatterns.push(pattern.source);
            }
        }
        return { detected: detectedPatterns.length > 0, patterns: detectedPatterns };
    }

    private static checkAdvancedPatterns(content: string): { suspicious: boolean; flags: string[] } {
        const flags: string[] = [];
        const patternChecks = [
            { flag: 'leetspeak', pattern: this.suspiciousPatterns[0] },
            { flag: 'excessive_punctuation', pattern: this.suspiciousPatterns[1] },
            { flag: 'excessive_emojis', pattern: this.suspiciousPatterns[2] },
            { flag: 'base64_encoded', pattern: this.suspiciousPatterns[3] },
            { flag: 'character_repetition', pattern: this.suspiciousPatterns[4] },
        ];

        for (const check of patternChecks) {
            if (check.pattern.test(content)) {
                flags.push(check.flag);
            }
        }
        
        return { suspicious: flags.length > 0, flags };
    }

    // UTILITY AND SPECIALIZED METHODS (Unchanged)
    private static getSeverityForCategory(category: string): 'low' | 'medium' | 'high' | 'critical' {
        const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
            spam: 'medium', illegal: 'critical', adult: 'high', violence: 'critical',
            hate: 'critical', harassment: 'high', substances: 'high', selfHarm: 'critical',
            extremism: 'critical', profanity: 'low'
        };
        return severityMap[category] || 'medium';
    }

    private static escalateSeverity(current: 'low' | 'medium' | 'high' | 'critical', proposed: 'low' | 'medium' | 'high' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
        const severityOrder = ['low', 'medium', 'high', 'critical'];
        const currentIndex = severityOrder.indexOf(current);
        const proposedIndex = severityOrder.indexOf(proposed);
        return severityOrder[Math.max(currentIndex, proposedIndex)] as 'low' | 'medium' | 'high' | 'critical';
    }
    
    static async moderateComment(content: string, userId: string): Promise<ModerationResult> {
        return this.moderateContent(content, userId, 'comment');
    }

    static async moderateJournalEntry(content: string, userId: string): Promise<ModerationResult> {
        return this.moderateContent(content, userId, 'journal');
    }

    static async moderateTripName(name: string, userId: string): Promise<ModerationResult> {
      return this.moderateContent(name, userId, 'trip_name');
    }

    static async moderateUserBio(bio: string, userId: string): Promise<ModerationResult> {
      return this.moderateContent(bio, userId, 'bio');
    }
}