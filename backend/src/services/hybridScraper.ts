import { scrapeWithGooglePlacesAPI } from './googlePlacesService';
import { scrapeAllGoogleReviews } from './googleScraperImproved';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

export async function scrapeAllReviewsHybrid(url: string, projectId: string) {
    try {
        console.log('Starting hybrid scraping: Google Places API + Web Scraping');

        let allReviews: any[] = [];
        let errors: string[] = [];

        // Step 1: Get high-quality reviews from Google Places API
        console.log('Step 1: Fetching reviews from Google Places API...');
        const placesResult = await scrapeWithGooglePlacesAPI(url, projectId);

        if (placesResult.success && placesResult.reviews) {
            allReviews = placesResult.reviews;
            console.log(`✅ Got ${placesResult.reviews.length} high-quality reviews from Places API`);
        } else {
            errors.push(`Places API: ${placesResult.error}`);
        }

        // Step 2: Get additional reviews via web scraping
        console.log('Step 2: Fetching additional reviews via web scraping...');
        const scrapingResult = await scrapeAllGoogleReviews(url, projectId);

        if (scrapingResult.success && scrapingResult.reviews) {
            // Filter out duplicates (compare by text similarity)
            const newReviews = scrapingResult.reviews.filter(scrapedReview =>
                !allReviews.some(existingReview =>
                    areSimilarReviews(existingReview.original_text, scrapedReview.original_text)
                )
            );

            if (newReviews.length > 0) {
                // Save additional reviews to database
                const { data: savedReviews, error: insertError } = await supabase
                    .from('reviews')
                    .insert(newReviews.map(review => ({
                        project_id: projectId,
                        original_text: review.original_text,
                        rating: review.rating,
                        author_name: review.author_name,
                        review_date: review.review_date,
                        source: 'web_scraping'
                    })))
                    .select();

                if (!insertError && savedReviews) {
                    allReviews = [...allReviews, ...savedReviews];
                    console.log(`✅ Got ${newReviews.length} additional reviews from web scraping`);
                }
            }
        } else {
            errors.push(`Web scraping: ${scrapingResult.error}`);
        }

        console.log(`🎉 Total reviews collected: ${allReviews.length}`);

        return {
            success: allReviews.length > 0,
            reviews: allReviews,
            totalCount: allReviews.length,
            sources: {
                placesAPI: placesResult.success ? placesResult.reviews?.length || 0 : 0,
                webScraping: scrapingResult.success ? scrapingResult.reviews?.length || 0 : 0
            },
            errors: errors.length > 0 ? errors : undefined
        };

    } catch (error) {
        console.error('Hybrid scraping error:', error);
        return {
            success: false,
            error: `Hybrid scraping failed: ${(error as Error).message}`
        };
    }
}

// Helper function to detect similar reviews
function areSimilarReviews(text1: string, text2: string): boolean {
    if (!text1 || !text2) return false;

    // Simple similarity check - you could use more sophisticated algorithms
    const shorter = text1.length < text2.length ? text1 : text2;
    const longer = text1.length >= text2.length ? text1 : text2;

    // If one text is contained within another, they're likely similar
    if (longer.toLowerCase().includes(shorter.toLowerCase())) {
        return true;
    }

    // Check for similar word overlap
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));

    return commonWords.length > Math.min(words1.length, words2.length) * 0.7;
} 