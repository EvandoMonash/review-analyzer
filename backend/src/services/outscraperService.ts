import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

interface OutscraperReview {
    review_text: string;
    review_rating: number;
    author_title: string;
    review_datetime_utc: string;
    review_likes?: number;
    author_reviews_count?: number;
}

export async function scrapeWithOutscraper(url: string, projectId: string, maxReviews: number = 1000): Promise<{ success: boolean; reviews?: any[]; error?: string; totalFound?: number; message?: string }> {
    try {
        const apiKey = process.env.OUTSCRAPER_API_KEY;

        if (!apiKey) {
            return { success: false, error: 'Outscraper API key not configured' };
        }

        console.log(`🔍 Fetching up to ${maxReviews} reviews from Outscraper for:`, url);
        console.log(`💰 Using PAID Outscraper plan - should support ${maxReviews} reviews`);

        // Extract and validate the Google Maps URL
        const processedUrl = processGoogleMapsUrl(url);
        console.log(`🔧 Processed URL:`, processedUrl);

        if (!processedUrl) {
            return { success: false, error: 'Invalid Google Maps URL format' };
        }

        console.log(`📡 Making API request to Outscraper...`);

        const requestParams = {
            query: processedUrl,
            reviewsLimit: Math.min(maxReviews, 1500), // Paid plans support higher limits
            language: 'en',
            region: 'AU', // Changed from US to Australia
            sort: 'newest', // Get newest reviews first
            cutoff: 0, // No rating cutoff
            ignoreEmpty: true, // Skip reviews without text
            // For paid plans, try additional parameters
            async: true, // Use async processing for large requests
            webhook: false // Don't use webhook
        };

        console.log(`📋 Request parameters:`, JSON.stringify(requestParams, null, 2));

        // Make the API request to Outscraper
        const response = await axios.get('https://api.app.outscraper.com/maps/reviews-v3', {
            params: requestParams,
            headers: {
                'X-API-KEY': apiKey
            },
            timeout: 60000 // 60 second timeout for large requests
        });

        console.log(`📊 API Response Status:`, response.status);
        console.log(`📊 API Response Headers:`, response.headers);

        // Log key response data without overwhelming output
        if (response.data && response.data.data && response.data.data[0]) {
            const place = response.data.data[0];
            console.log(`📊 Place name:`, place.name);
            console.log(`📊 Total reviews available:`, place.reviews_count || place.total_reviews);
            console.log(`📊 Reviews returned in response:`, (place.reviews_data || place.reviews || []).length);
            console.log(`📊 Request parameters used:`, JSON.stringify(requestParams, null, 2));
        } else {
            console.log(`📊 API Response Data:`, JSON.stringify(response.data, null, 2));
        }

        // Handle async processing (status 202)
        if (response.status === 202 && response.data.status === 'Pending') {
            console.log(`⏳ Request is being processed asynchronously. Polling for results...`);

            const resultsUrl = response.data.results_location;
            if (!resultsUrl) {
                return { success: false, error: 'No results location provided for async request' };
            }

            // Poll for results
            const finalData = await pollForResults(resultsUrl, apiKey);
            if (!finalData.success) {
                return finalData;
            }

            // Process the results
            return await processScrapingResults(finalData.data, projectId, maxReviews);
        }

        // Handle immediate response (status 200)
        if (response.status === 200) {
            return await processScrapingResults(response.data, projectId, maxReviews);
        }

        // Unexpected status
        return { success: false, error: `Unexpected response status: ${response.status}` };

    } catch (error) {
        console.error('❌ Outscraper Error:', error);
        if (axios.isAxiosError(error) && error.response) {
            const errorMessage = error.response.data?.error || error.response.data?.message || error.message;
            console.error('❌ API Error Details:', error.response.data);
            return {
                success: false,
                error: `Outscraper request failed: ${error.response.status} - ${errorMessage}`
            };
        }
        return { success: false, error: `Outscraper request failed: ${(error as Error).message}` };
    }
}

// Poll for async results
async function pollForResults(resultsUrl: string, apiKey: string, maxAttempts: number = 12): Promise<{ success: boolean; data?: any; error?: string }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`🔄 Polling attempt ${attempt}/${maxAttempts}...`);

            const response = await axios.get(resultsUrl, {
                headers: { 'X-API-KEY': apiKey },
                timeout: 10000
            });

            console.log(`📊 Poll response status:`, response.status);

            if (response.status === 200 && response.data.status === 'Success') {
                console.log(`✅ Results ready!`);
                return { success: true, data: response.data };
            }

            if (response.data.status === 'Failed') {
                return { success: false, error: 'Outscraper processing failed' };
            }

            // Still pending, wait before next attempt
            const waitTime = Math.min(5000 * attempt, 30000); // Exponential backoff, max 30s
            console.log(`⏳ Still processing... waiting ${waitTime / 1000}s before next check`);
            await new Promise(resolve => setTimeout(resolve, waitTime));

        } catch (error) {
            console.error(`❌ Poll attempt ${attempt} failed:`, error);
            if (attempt === maxAttempts) {
                return { success: false, error: 'Polling timeout - results not ready' };
            }
        }
    }

    return { success: false, error: 'Polling timeout - max attempts reached' };
}

// Process the scraping results data
async function processScrapingResults(responseData: any, projectId: string, maxReviews: number = 1000): Promise<{ success: boolean; reviews?: any[]; error?: string; totalFound?: number; message?: string }> {
    // Check if we have any data at all
    if (!responseData) {
        console.log(`❌ No response data at all`);
        return { success: false, error: 'No response data from Outscraper' };
    }

    if (!responseData.data) {
        console.log(`❌ No 'data' property in response`);
        console.log(`📊 Available properties:`, Object.keys(responseData));
        return { success: false, error: 'Unexpected response structure from Outscraper' };
    }

    if (responseData.data.length === 0) {
        console.log(`❌ Empty data array - business might not exist`);
        return { success: false, error: 'No business data returned from Outscraper. The business might not exist or have no reviews.' };
    }

    const place = responseData.data[0];
    console.log(`🏢 Business found:`, place.name || 'Unknown');
    console.log(`📍 Business address:`, place.full_address || 'Unknown');
    console.log(`⭐ Business rating:`, place.rating || 'No rating');
    console.log(`📊 Place object keys:`, Object.keys(place));

    // Check for reviews with more detailed logging
    const reviews = place.reviews_data || place.reviews || [];
    const totalFound = place.reviews_count || place.total_reviews || reviews.length;

    console.log(`📝 Reviews property name:`, place.reviews_data ? 'reviews_data' : place.reviews ? 'reviews' : 'none');
    console.log(`✅ Found ${reviews.length} reviews from Outscraper (${totalFound} total available)`);
    console.log(`📊 Paid plan: requesting up to ${Math.min(maxReviews, 1500)} reviews`);

    if (reviews.length < totalFound) {
        console.log(`⚠️  Only got ${reviews.length} out of ${totalFound} available reviews`);
        console.log(`💡 With paid Outscraper plan, this could be due to:`);
        console.log(`   - Google Maps internal pagination limits`);
        console.log(`   - Regional API restrictions`);
        console.log(`   - Request timeout or rate limiting`);
        console.log(`   - Need for multiple paginated requests`);
    }

    if (reviews.length === 0) {
        console.log(`❌ Business exists but has no reviews`);
        console.log(`🏢 Business info:`, {
            name: place.name,
            address: place.full_address,
            rating: place.rating,
            phone: place.phone,
            website: place.website
        });
        return {
            success: false,
            error: `Business "${place.name || 'Unknown'}" found but has no reviews yet. Try a business with more reviews.`,
            totalFound: 0
        };
    }

    // Log first review for debugging
    if (reviews.length > 0) {
        console.log(`📝 Sample review:`, JSON.stringify(reviews[0], null, 2));
    }

    // Transform Outscraper reviews to our database format
    const transformedReviews = reviews.map((review: OutscraperReview) => ({
        project_id: projectId,
        original_text: review.review_text || '',
        rating: review.review_rating || 0,
        author_name: review.author_title || 'Anonymous',
        review_date: parseOutscraperDate(review.review_datetime_utc),
        source: 'outscraper_api'
    })).filter((review: any) => review.original_text.length > 0); // Only include reviews with text

    console.log(`💾 Saving ${transformedReviews.length} valid reviews to database...`);

    if (transformedReviews.length === 0) {
        console.log(`❌ No reviews with text content after filtering`);
        return { success: false, error: 'No valid reviews with text content found' };
    }

    // Save reviews to database
    const { data: savedReviews, error: insertError } = await supabase
        .from('reviews')
        .insert(transformedReviews)
        .select();

    if (insertError) {
        console.error('❌ Error saving reviews:', insertError);
        return { success: false, error: 'Failed to save reviews to database' };
    }

    console.log(`🎉 Successfully saved ${savedReviews?.length || 0} reviews to database`);

    return {
        success: true,
        reviews: savedReviews,
        totalFound: totalFound,
        ...(reviews.length < totalFound && {
            message: `Scraped ${reviews.length} out of ${totalFound} available reviews. With your paid plan, this may be due to Google's pagination limits or regional restrictions.`
        })
    };
}

// Process and validate Google Maps URL
function processGoogleMapsUrl(url: string): string | null {
    try {
        // If it's already a clean business name or place ID, return as is
        if (!url.includes('google.com') && !url.includes('maps.google') && !url.includes('goo.gl') && !url.includes('maps.app')) {
            return url;
        }

        // For shortened URLs, we'll pass them directly but log a warning
        if (url.includes('goo.gl') || url.includes('maps.app')) {
            console.log(`🔗 Detected shortened Google Maps URL. If this fails, try expanding the URL manually.`);
            console.log(`💡 Tip: Visit ${url} in browser and copy the expanded URL`);
            return url;
        }

        // Extract place information from various Google Maps URL formats
        const placeQuery = extractPlaceFromUrl(url);
        if (placeQuery) {
            return placeQuery;
        }

        // If we can't extract anything specific, return the original URL
        // Outscraper can often handle raw Google Maps URLs
        return url;
    } catch (error) {
        console.error('Error processing Google Maps URL:', error);
        return null;
    }
}

// Extract place information from Google Maps URL
function extractPlaceFromUrl(url: string): string | null {
    try {
        // Method 1: Extract place name from URL path
        const placeMatch = url.match(/place\/([^/@?]+)/);
        if (placeMatch) {
            const placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
            return placeName;
        }

        // Method 2: Extract from search query
        const searchMatch = url.match(/search\/([^/@?]+)/);
        if (searchMatch) {
            const searchQuery = decodeURIComponent(searchMatch[1]).replace(/\+/g, ' ');
            return searchQuery;
        }

        // Method 3: Extract data ID (Outscraper can handle these)
        const dataIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
        if (dataIdMatch) {
            return url; // Return full URL for data ID
        }

        return null;
    } catch (error) {
        console.error('Error extracting place from URL:', error);
        return null;
    }
}

// Parse Outscraper date format to YYYY-MM-DD
function parseOutscraperDate(dateString: string): string {
    try {
        if (!dateString) return new Date().toISOString().split('T')[0];

        // Outscraper typically returns ISO format dates
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }

        // Fallback to current date
        return new Date().toISOString().split('T')[0];
    } catch (error) {
        console.error('Error parsing date:', dateString, error);
        return new Date().toISOString().split('T')[0];
    }
}

// Test function to check API key and account status
export async function testOutscraperAPI(): Promise<{ success: boolean; message: string; creditsLeft?: number }> {
    try {
        console.log('🧪 Testing Outscraper API...');

        const apiKey = process.env.OUTSCRAPER_API_KEY;

        if (!apiKey) {
            console.log('❌ No API key found');
            return { success: false, message: 'Outscraper API key not configured' };
        }

        console.log('🔑 API key found, making test request...');

        // Test with a simple request to check API status - with shorter timeout
        const response = await axios.get('https://api.app.outscraper.com/requests', {
            headers: {
                'X-API-KEY': apiKey
            },
            timeout: 5000 // Reduced to 5 seconds
        });

        console.log('✅ First request successful, checking profile...');

        // Check if we can access the account info - with shorter timeout
        const accountResponse = await axios.get('https://api.app.outscraper.com/profile', {
            headers: {
                'X-API-KEY': apiKey
            },
            timeout: 5000 // Reduced to 5 seconds
        });

        console.log('✅ Profile request successful');

        return {
            success: true,
            message: 'Outscraper API connected successfully!',
            creditsLeft: accountResponse.data?.requests_left || 0
        };
    } catch (error) {
        console.error('❌ Outscraper test error:', error);
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                return {
                    success: false,
                    message: 'Outscraper API timeout - check your internet connection'
                };
            }
            if (error.response) {
                return {
                    success: false,
                    message: `Outscraper test failed: ${error.response.status} - ${error.response.data?.error || error.message}`
                };
            }
            return {
                success: false,
                message: `Outscraper test failed: Network error - ${error.message}`
            };
        }
        return {
            success: false,
            message: `Outscraper test failed: ${(error as Error).message}`
        };
    }
} 