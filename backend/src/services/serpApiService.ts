/**
 * @deprecated This service has been replaced by outscraperService.ts
 * Kept for reference but no longer used in the application.
 * Can be safely removed if Outscraper proves stable.
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

interface SerpReview {
    position: number;
    user: {
        name: string;
        link?: string;
        thumbnail?: string;
        reviews?: number;
        photos?: number;
    };
    rating: number;
    date: string;
    snippet: string;
    likes?: number;
    images?: string[];
}

export async function scrapeWithSerpAPI(url: string, projectId: string, maxReviews: number = 100): Promise<{ success: boolean; reviews?: any[]; error?: string; totalFound?: number }> {
    try {
        const apiKey = process.env.SERPAPI_KEY;

        if (!apiKey) {
            return { success: false, error: 'SerpAPI key not configured' };
        }

        console.log(`🔍 Fetching up to ${maxReviews} reviews from SerpAPI for:`, url);

        // Extract data ID or place name from Google Maps URL
        const placeQuery = extractPlaceQuery(url);
        if (!placeQuery) {
            return { success: false, error: 'Could not extract place information from URL' };
        }

        let allReviews: any[] = [];
        let nextPageToken = '';
        let totalFound = 0;

        // Fetch multiple pages if needed
        while (allReviews.length < maxReviews) {
            console.log(`📄 Fetching page ${Math.floor(allReviews.length / 20) + 1}...`);

            const response = await axios.get('https://serpapi.com/search', {
                params: {
                    engine: 'google_maps_reviews',
                    data_id: placeQuery.dataId || undefined,
                    q: placeQuery.query || undefined,
                    hl: 'en',
                    gl: 'us',
                    sort_by: 'newestFirst',
                    reviews_limit: Math.min(100, maxReviews - allReviews.length), // Request remaining reviews
                    next_page_token: nextPageToken || undefined, // For pagination
                    api_key: apiKey
                },
                timeout: 30000
            });

            if (response.data.error) {
                return { success: false, error: `SerpAPI Error: ${response.data.error}` };
            }

            const reviews = response.data.reviews || [];
            totalFound = response.data.search_information?.total_results || reviews.length;

            console.log(`✅ Found ${reviews.length} reviews on this page`);

            if (reviews.length === 0) {
                console.log('No more reviews available');
                break;
            }

            allReviews = [...allReviews, ...reviews];

            // Check if there's a next page
            nextPageToken = response.data.serpapi_pagination?.next_page_token;
            if (!nextPageToken) {
                console.log('No more pages available');
                break;
            }

            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`🎉 Total reviews collected: ${allReviews.length} out of ${totalFound} available`);

        // Transform SerpAPI reviews to our format
        const transformedReviews = allReviews.map((review) => ({
            project_id: projectId,
            original_text: review.snippet || '',
            rating: review.rating || 0,
            author_name: review.user?.name || 'Anonymous',
            review_date: parseReviewDate(review.date),
            source: 'serpapi'
        })).filter(review => review.original_text.length > 0);

        console.log(`💾 Saving ${transformedReviews.length} valid reviews to database...`);

        // Save reviews to database
        const { data: savedReviews, error: insertError } = await supabase
            .from('reviews')
            .insert(transformedReviews)
            .select();

        if (insertError) {
            console.error('❌ Error saving reviews:', insertError);
            return { success: false, error: 'Failed to save reviews to database' };
        }

        return {
            success: true,
            reviews: savedReviews,
            totalFound: totalFound
        };

    } catch (error) {
        console.error('❌ SerpAPI Error:', error);
        if (axios.isAxiosError(error) && error.response) {
            return {
                success: false,
                error: `SerpAPI request failed: ${error.response.status} - ${error.response.data?.error || error.message}`
            };
        }
        return { success: false, error: `SerpAPI request failed: ${(error as Error).message}` };
    }
}

// Extract place query from Google Maps URL
function extractPlaceQuery(url: string): { dataId?: string; query?: string } | null {
    try {
        // Method 1: Extract data_id from URL (most reliable)
        const dataIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
        if (dataIdMatch) {
            return { dataId: dataIdMatch[1] };
        }

        // Method 2: Extract place name from URL
        const placeMatch = url.match(/place\/([^/@?]+)/);
        if (placeMatch) {
            const placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
            return { query: placeName };
        }

        // Method 3: Extract from search query
        const searchMatch = url.match(/search\/([^/@?]+)/);
        if (searchMatch) {
            const searchQuery = decodeURIComponent(searchMatch[1]).replace(/\+/g, ' ');
            return { query: searchQuery };
        }

        return null;
    } catch (error) {
        console.error('Error extracting place query:', error);
        return null;
    }
}

// Parse review date from various formats
function parseReviewDate(dateString: string): string {
    try {
        if (!dateString) return new Date().toISOString().split('T')[0];

        // Handle relative dates like "2 weeks ago", "1 month ago"
        const now = new Date();

        if (dateString.includes('week') && dateString.includes('ago')) {
            const weeks = parseInt(dateString.match(/(\d+)/)?.[1] || '0');
            now.setDate(now.getDate() - (weeks * 7));
            return now.toISOString().split('T')[0];
        }

        if (dateString.includes('month') && dateString.includes('ago')) {
            const months = parseInt(dateString.match(/(\d+)/)?.[1] || '0');
            now.setMonth(now.getMonth() - months);
            return now.toISOString().split('T')[0];
        }

        if (dateString.includes('year') && dateString.includes('ago')) {
            const years = parseInt(dateString.match(/(\d+)/)?.[1] || '0');
            now.setFullYear(now.getFullYear() - years);
            return now.toISOString().split('T')[0];
        }

        if (dateString.includes('day') && dateString.includes('ago')) {
            const days = parseInt(dateString.match(/(\d+)/)?.[1] || '0');
            now.setDate(now.getDate() - days);
            return now.toISOString().split('T')[0];
        }

        // Try to parse as regular date
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }

        // Default to today
        return new Date().toISOString().split('T')[0];
    } catch (error) {
        return new Date().toISOString().split('T')[0];
    }
}

// Test function to check API key and credits
export async function testSerpAPI(): Promise<{ success: boolean; message: string; creditsLeft?: number }> {
    try {
        const apiKey = process.env.SERPAPI_KEY;

        if (!apiKey) {
            return { success: false, message: 'SerpAPI key not configured' };
        }

        const response = await axios.get('https://serpapi.com/account', {
            params: { api_key: apiKey }
        });

        const accountInfo = response.data;

        return {
            success: true,
            message: `SerpAPI connected successfully!`,
            creditsLeft: accountInfo.searches_left || 0
        };
    } catch (error) {
        return {
            success: false,
            message: `SerpAPI test failed: ${(error as Error).message}`
        };
    }
} 