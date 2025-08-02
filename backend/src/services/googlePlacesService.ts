import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

interface GoogleReview {
    text: string;
    rating: number;
    author_name: string;
    time: number;
}

export async function scrapeWithGooglePlacesAPI(url: string, projectId: string): Promise<{ success: boolean; reviews?: any[]; error?: string }> {
    try {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;

        if (!apiKey) {
            return { success: false, error: 'Google Places API key not configured' };
        }

        // Extract place ID from Google Maps URL
        const placeId = await getPlaceIdFromUrl(url);
        if (!placeId) {
            return { success: false, error: 'Could not extract place ID from URL' };
        }

        console.log('Fetching reviews from Google Places API for place:', placeId);

        // Get place details with reviews
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
            params: {
                place_id: placeId,
                fields: 'name,reviews,rating,user_ratings_total',
                key: apiKey
            }
        });

        if (response.data.status !== 'OK') {
            return { success: false, error: `Google API error: ${response.data.status}` };
        }

        const reviews = response.data.result.reviews || [];
        console.log(`Found ${reviews.length} reviews from Google Places API`);

        // Transform and save reviews
        const reviewInserts = reviews.map((review: GoogleReview) => ({
            project_id: projectId,
            original_text: review.text,
            rating: review.rating,
            author_name: review.author_name,
            review_date: new Date(review.time * 1000).toISOString().split('T')[0],
            source: 'google_api'
        }));

        const { data: savedReviews, error: insertError } = await supabase
            .from('reviews')
            .insert(reviewInserts)
            .select();

        if (insertError) {
            console.error('Error saving reviews:', insertError);
            return { success: false, error: 'Failed to save reviews to database' };
        }

        return { success: true, reviews: savedReviews };

    } catch (error) {
        console.error('Error with Google Places API:', error);
        return { success: false, error: 'Failed to fetch reviews from Google Places API' };
    }
}

// Extract place ID from Google Maps URL
async function getPlaceIdFromUrl(url: string): Promise<string | null> {
    try {
        // Method 1: Extract from URL if place_id is present
        const placeIdMatch = url.match(/place_id=([^&]+)/);
        if (placeIdMatch) {
            return placeIdMatch[1];
        }

        // Method 2: Use Google Places API to find place by name/location
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) return null;

        // Extract business name from URL
        const nameMatch = url.match(/place\/([^/@]+)/);
        if (!nameMatch) return null;

        const businessName = decodeURIComponent(nameMatch[1].replace(/\+/g, ' '));

        // Search for the place
        const searchResponse = await axios.get('https://maps.googleapis.com/maps/api/place/findplacefromtext/json', {
            params: {
                input: businessName,
                inputtype: 'textquery',
                fields: 'place_id',
                key: apiKey
            }
        });

        if (searchResponse.data.status === 'OK' && searchResponse.data.candidates.length > 0) {
            return searchResponse.data.candidates[0].place_id;
        }

        return null;
    } catch (error) {
        console.error('Error extracting place ID:', error);
        return null;
    }
} 