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
        // Attach catch block to try for proper error handling
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