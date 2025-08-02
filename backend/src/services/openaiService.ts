import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables first
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface ReviewAnalysisResult {
    primary_category: 'positive' | 'negative' | 'neutral';
    primary_confidence: number;
    secondary_categories: string[];
    themes: string[];
    sentiment_score: number;
    key_phrases: string[];
    summary: string;
}

export async function analyzeReview(reviewText: string, rating?: number): Promise<ReviewAnalysisResult> {
    const prompt = `
Analyze this review and respond with ONLY a valid JSON object. No additional text before or after.

Review: "${reviewText}"
${rating ? `Rating: ${rating}/5 stars` : ''}

Return this exact JSON structure:
{
  "primary_category": "positive|negative|neutral",
  "primary_confidence": 0.95,
  "secondary_categories": ["category1", "category2"],
  "themes": ["theme1", "theme2"],
  "sentiment_score": 0.8,
  "key_phrases": ["phrase1", "phrase2"],
  "summary": "Brief summary here"
}

Rules:
- primary_category must be exactly "positive", "negative", or "neutral"
- primary_confidence must be a number between 0 and 1
- sentiment_score must be a number between -1 and 1
- All arrays must contain strings
- Use double quotes only
- No trailing commas
- Return ONLY the JSON object`;

    try {
        console.log('Sending request to OpenAI...');
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a review analyzer. You must respond with ONLY valid JSON. No explanations, no markdown, no extra text. Just pure JSON.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.1, // Lower temperature for more consistent JSON
            max_tokens: 500,
        });

        console.log('OpenAI response received');
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }

        console.log('Raw OpenAI content:', content);

        // Clean the content before parsing
        const cleanedContent = cleanJsonResponse(content);
        console.log('Cleaned content:', cleanedContent);

        // Try to parse the JSON
        let parsedResult;
        try {
            parsedResult = JSON.parse(cleanedContent);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Content that failed to parse:', cleanedContent);

            // Try alternative parsing methods
            parsedResult = attemptFallbackParsing(cleanedContent, reviewText, rating);
        }

        // Validate and sanitize the result
        const validatedResult = validateAndSanitizeResult(parsedResult, reviewText, rating);

        return validatedResult;

    } catch (error) {
        console.error('Detailed error analyzing review:', error);

        // Return a safe fallback analysis
        return createFallbackAnalysis(reviewText, rating);
    }
}

// Ultra-fast simplified analysis for speed optimization
export async function analyzeReviewFast(reviewText: string, rating?: number): Promise<ReviewAnalysisResult> {
    const prompt = `Analyze: "${reviewText}"
Rating: ${rating || 'N/A'}/5

JSON only:
{
  "primary_category": "positive|negative|neutral",
  "primary_confidence": 0.9,
  "secondary_categories": ["service"],
  "themes": ["experience"],
  "sentiment_score": 0.5,
  "key_phrases": ["good"],
  "summary": "Brief summary"
}`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'Return only valid JSON. No explanations.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0,
            max_tokens: 200, // Reduced from 500 to 200
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const cleanedContent = cleanJsonResponse(content);
        let parsedResult;

        try {
            parsedResult = JSON.parse(cleanedContent);
        } catch (parseError) {
            parsedResult = attemptFallbackParsing(cleanedContent, reviewText, rating);
        }

        return validateAndSanitizeResult(parsedResult, reviewText, rating);

    } catch (error) {
        console.error('Fast analysis error:', error);
        return createFallbackAnalysis(reviewText, rating);
    }
}

// Clean up common JSON formatting issues
function cleanJsonResponse(content: string): string {
    // Remove markdown code blocks if present
    let cleaned = content.replace(/```json\s*|\s*```/g, '');

    // Remove any text before the first {
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0) {
        cleaned = cleaned.substring(firstBrace);
    }

    // Remove any text after the last }
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
        cleaned = cleaned.substring(0, lastBrace + 1);
    }

    // Fix common JSON issues
    cleaned = cleaned
        .replace(/'/g, '"') // Replace single quotes with double quotes
        .replace(/,\s*}/g, '}') // Remove trailing commas before }
        .replace(/,\s*]/g, ']') // Remove trailing commas before ]
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();

    return cleaned;
}

// Attempt to extract information even from malformed JSON
function attemptFallbackParsing(content: string, reviewText: string, rating?: number): any {
    console.log('Attempting fallback parsing...');

    try {
        // Try to extract key information using regex
        const primaryCategoryMatch = content.match(/"primary_category":\s*"(positive|negative|neutral)"/);
        const confidenceMatch = content.match(/"primary_confidence":\s*([\d.]+)/);
        const sentimentMatch = content.match(/"sentiment_score":\s*([-\d.]+)/);

        return {
            primary_category: primaryCategoryMatch ? primaryCategoryMatch[1] : 'neutral',
            primary_confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
            secondary_categories: ['general'],
            themes: ['review analysis'],
            sentiment_score: sentimentMatch ? parseFloat(sentimentMatch[1]) : 0,
            key_phrases: ['analysis'],
            summary: reviewText.substring(0, 100) + '...'
        };
    } catch (error) {
        console.error('Fallback parsing failed:', error);
        return createFallbackAnalysis(reviewText, rating);
    }
}

// Validate and ensure the result has all required fields
function validateAndSanitizeResult(result: any, reviewText: string, rating?: number): ReviewAnalysisResult {
    try {
        // Ensure primary_category is valid
        const validCategories = ['positive', 'negative', 'neutral'];
        const primary_category = validCategories.includes(result.primary_category)
            ? result.primary_category
            : inferCategoryFromRating(rating);

        // Ensure confidence is a valid number between 0 and 1
        let primary_confidence = parseFloat(result.primary_confidence) || 0.5;
        primary_confidence = Math.max(0, Math.min(1, primary_confidence));

        // Ensure sentiment_score is between -1 and 1
        let sentiment_score = parseFloat(result.sentiment_score) || 0;
        sentiment_score = Math.max(-1, Math.min(1, sentiment_score));

        // Ensure arrays are arrays and contain strings - with explicit types
        const secondary_categories = Array.isArray(result.secondary_categories)
            ? result.secondary_categories.filter((item: any) => typeof item === 'string').slice(0, 5)
            : ['general'];

        const themes = Array.isArray(result.themes)
            ? result.themes.filter((item: any) => typeof item === 'string').slice(0, 5)
            : ['general feedback'];

        const key_phrases = Array.isArray(result.key_phrases)
            ? result.key_phrases.filter((item: any) => typeof item === 'string').slice(0, 5)
            : ['review'];

        // Ensure summary is a string
        const summary = typeof result.summary === 'string' && result.summary.length > 0
            ? result.summary.substring(0, 200)
            : `Review about ${themes[0] || 'service'} with ${primary_category} sentiment`;

        return {
            primary_category,
            primary_confidence,
            secondary_categories,
            themes,
            sentiment_score,
            key_phrases,
            summary
        };

    } catch (error) {
        console.error('Error validating result:', error);
        return createFallbackAnalysis(reviewText, rating);
    }
}

// Create a fallback analysis when all else fails
function createFallbackAnalysis(reviewText: string, rating?: number): ReviewAnalysisResult {
    const category = inferCategoryFromRating(rating);
    const sentimentScore = rating ? (rating - 3) / 2 : 0; // Convert 1-5 rating to -1 to 1 sentiment

    return {
        primary_category: category,
        primary_confidence: 0.6,
        secondary_categories: ['general'],
        themes: ['customer experience'],
        sentiment_score: sentimentScore,
        key_phrases: [reviewText.split(' ').slice(0, 3).join(' ')],
        summary: `Customer review expressing ${category} sentiment about the service`
    };
}

// Infer category from rating if available
function inferCategoryFromRating(rating?: number): 'positive' | 'negative' | 'neutral' {
    if (!rating) return 'neutral';
    if (rating >= 4) return 'positive';
    if (rating <= 2) return 'negative';
    return 'neutral';
}

export async function batchAnalyzeReviews(reviews: Array<{ id: string, text: string, rating?: number }>): Promise<Array<{ id: string, analysis: ReviewAnalysisResult }>> {
    const results: Array<{ id: string, analysis: ReviewAnalysisResult }> = [];

    for (const review of reviews) {
        try {
            const analysis = await analyzeReview(review.text, review.rating);
            results.push({ id: review.id, analysis });

            // Add delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Error analyzing review ${review.id}:`, error);
            // Continue with other reviews even if one fails
        }
    }

    return results;
}

export async function batchAnalyzeReviewsFast(reviews: Array<{ id: string, text: string, rating?: number }>, concurrency: number = 5): Promise<Array<{ id: string, analysis: ReviewAnalysisResult }>> {
    const results: Array<{ id: string, analysis: ReviewAnalysisResult }> = [];

    // Process reviews in parallel batches
    for (let i = 0; i < reviews.length; i += concurrency) {
        const batch = reviews.slice(i, i + concurrency);
        console.log(`📦 Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(reviews.length / concurrency)} (${batch.length} reviews)`);

        // Process this batch in parallel
        const batchPromises = batch.map(async review => {
            try {
                const analysis = await analyzeReview(review.text, review.rating);
                return { id: review.id, analysis };
            } catch (error) {
                console.error(`Error analyzing review ${review.id}:`, error);
                // Return fallback analysis on error
                return {
                    id: review.id,
                    analysis: createFallbackAnalysis(review.text, review.rating)
                };
            }
        });

        // Wait for this batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches to respect rate limits
        if (i + concurrency < reviews.length) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 0.5s vs 1s
        }
    }

    return results;
}

// Ultra-fast batch processing with higher concurrency
export async function batchAnalyzeReviewsUltraFast(reviews: Array<{ id: string, text: string, rating?: number }>, concurrency: number = 15): Promise<Array<{ id: string, analysis: ReviewAnalysisResult }>> {
    const results: Array<{ id: string, analysis: ReviewAnalysisResult }> = [];

    // Process reviews in parallel batches with higher concurrency
    for (let i = 0; i < reviews.length; i += concurrency) {
        const batch = reviews.slice(i, i + concurrency);
        console.log(`⚡ ULTRA-FAST batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(reviews.length / concurrency)} (${batch.length} reviews)`);

        // Process this batch in parallel with fast analysis
        const batchPromises = batch.map(async review => {
            try {
                const analysis = await analyzeReviewFast(review.text, review.rating);
                return { id: review.id, analysis };
            } catch (error) {
                console.error(`Error analyzing review ${review.id}:`, error);
                return {
                    id: review.id,
                    analysis: createFallbackAnalysis(review.text, review.rating)
                };
            }
        });

        // Wait for this batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Minimal delay between batches
        if (i + concurrency < reviews.length) {
            await new Promise(resolve => setTimeout(resolve, 200)); // Reduced to 200ms
        }
    }

    return results;
} 