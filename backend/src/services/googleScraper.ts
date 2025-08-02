import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

interface ScrapedReview {
    text: string;
    rating: number;
    author_name: string;
    date: string;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function scrapeGoogleReviews(url: string, projectId: string): Promise<{ success: boolean; reviews?: ScrapedReview[]; error?: string }> {
    let browser;

    try {
        console.log('Starting Google Reviews scraping for:', url);

        browser = await puppeteer.launch({
            headless: false, // Keep false for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('Navigating to Google Maps URL...');
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        await wait(5000);

        // Find and click Reviews tab
        console.log('Looking for reviews section...');
        try {
            await page.waitForSelector('button[data-value="Reviews"]', { timeout: 10000 });
            await page.click('button[data-value="Reviews"]');
            console.log('Clicked Reviews tab');
            await wait(3000);
        } catch (error) {
            console.log('Reviews button not found, trying alternative...');
            try {
                const reviewButton = await page.$('button[aria-label*="reviews" i]');
                if (reviewButton) {
                    await reviewButton.click();
                    console.log('Clicked alternative reviews button');
                    await wait(3000);
                }
            } catch (e) {
                console.log('Alternative reviews button not found');
            }
        }

        // Aggressive scrolling to load more reviews
        console.log('Starting aggressive scrolling to load all reviews...');
        await loadAllReviews(page);

        // Extract reviews
        console.log('Extracting review data...');
        const reviews = await page.evaluate(() => {
            const extractedReviews: any[] = [];

            // Try multiple selectors for review containers
            const reviewSelectors = [
                '[data-review-id]',
                '.jftiEf',
                '.MyEned',
                'div[data-reviewid]',
                '.ODSEW-ShBeI'
            ];

            let reviewElements: NodeListOf<Element> | null = null;

            for (const selector of reviewSelectors) {
                reviewElements = document.querySelectorAll(selector);
                console.log(`Selector ${selector} found ${reviewElements.length} elements`);
                if (reviewElements.length > 0) {
                    console.log(`Using selector: ${selector}`);
                    break;
                }
            }

            if (!reviewElements || reviewElements.length === 0) {
                console.log('No review elements found');
                return [];
            }

            reviewElements.forEach((reviewElement, index) => {
                try {
                    // Extract rating
                    let rating = 0;
                    const ratingElement = reviewElement.querySelector('[role="img"][aria-label*="star"], .kvMYJc, [aria-label*="star"]');
                    if (ratingElement) {
                        const ariaLabel = ratingElement.getAttribute('aria-label') || '';
                        const ratingMatch = ariaLabel.match(/(\d+)\s*star/i);
                        if (ratingMatch) {
                            rating = parseInt(ratingMatch[1]);
                        }
                    }

                    // Extract review text
                    let text = '';
                    const textSelectors = [
                        '.wiI7pd',
                        '.MyEned',
                        '[data-expandable-section]',
                        '.rsqaWe',
                        'span[jsaction*="click"]'
                    ];

                    for (const selector of textSelectors) {
                        const textElement = reviewElement.querySelector(selector);
                        if (textElement && textElement.textContent && textElement.textContent.trim().length > 10) {
                            text = textElement.textContent.trim();
                            break;
                        }
                    }

                    // Extract author name
                    let author_name = 'Anonymous';
                    const authorSelectors = [
                        '.d4r55',
                        '.TSUbDb',
                        '[data-value="Name"]',
                        '.YOGjf'
                    ];

                    for (const selector of authorSelectors) {
                        const authorElement = reviewElement.querySelector(selector);
                        if (authorElement && authorElement.textContent) {
                            author_name = authorElement.textContent.trim();
                            break;
                        }
                    }

                    if (text && text.length > 5) {
                        if (rating === 0) rating = 3; // Default rating

                        extractedReviews.push({
                            text,
                            rating,
                            author_name,
                            date: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    console.error(`Error extracting review ${index + 1}:`, error);
                }
            });

            return extractedReviews;
        });

        console.log(`Successfully extracted ${reviews.length} reviews`);

        if (reviews.length === 0) {
            return { success: false, error: 'No reviews found.' };
        }

        // Save reviews to database
        const reviewInserts = reviews.map(review => ({
            project_id: projectId,
            original_text: review.text,
            rating: review.rating,
            author_name: review.author_name,
            review_date: new Date(review.date).toISOString().split('T')[0],
            source: 'google_url'
        }));

        const { data: savedReviews, error: insertError } = await supabase
            .from('reviews')
            .insert(reviewInserts)
            .select();

        if (insertError) {
            console.error('Error saving reviews:', insertError);
            return { success: false, error: 'Failed to save reviews to database' };
        }

        console.log(`Successfully saved ${savedReviews.length} reviews`);
        return { success: true, reviews };

    } catch (error) {
        console.error('Error scraping Google reviews:', error);
        return { success: false, error: `Failed to scrape reviews: ${(error as Error).message}` };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Enhanced function to load ALL reviews
async function loadAllReviews(page: any, maxReviews: number = 200) {
    console.log(`Attempting to load up to ${maxReviews} reviews...`);

    let previousCount = 0;
    let currentCount = 0;
    let noNewReviewsCount = 0;
    const maxNoNewReviews = 5; // Stop after 5 attempts with no new reviews

    for (let attempt = 1; attempt <= 50; attempt++) {
        console.log(`Scroll attempt ${attempt}`);

        // Scroll the main page
        await page.evaluate(() => {
            window.scrollBy(0, 800);
        });
        await wait(1000);

        // Try to find and scroll the reviews container specifically
        await page.evaluate(() => {
            // Look for review list containers
            const containers = [
                '.m6QErb.DxyBCb.kA9KIf.dS8AEf', // Common review container
                '.review-dialog-list',
                '.section-scrollbox',
                '[data-reviewid]',
                '.siAUzd-neVct'
            ];

            for (const containerSelector of containers) {
                const container = document.querySelector(containerSelector);
                if (container) {
                    console.log(`Scrolling in container: ${containerSelector}`);
                    container.scrollBy(0, 500);
                    break;
                }
            }

            // Also try scrolling any scrollable divs within the page
            const scrollableElements = document.querySelectorAll('div[style*="overflow"], div[style*="scroll"]');
            scrollableElements.forEach(element => {
                if (element.scrollHeight > element.clientHeight) {
                    element.scrollBy(0, 300);
                }
            });
        });

        await wait(2000);

        // Count current reviews
        currentCount = await page.evaluate(() => {
            const selectors = ['[data-review-id]', '.jftiEf', '.MyEned'];
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) return elements.length;
            }
            return 0;
        });

        console.log(`Found ${currentCount} reviews (was ${previousCount})`);

        // Check if we found new reviews
        if (currentCount > previousCount) {
            noNewReviewsCount = 0; // Reset counter
            previousCount = currentCount;
        } else {
            noNewReviewsCount++;
            console.log(`No new reviews found (${noNewReviewsCount}/${maxNoNewReviews})`);
        }

        // Stop conditions
        if (currentCount >= maxReviews) {
            console.log(`Reached maximum reviews limit: ${maxReviews}`);
            break;
        }

        if (noNewReviewsCount >= maxNoNewReviews) {
            console.log('No new reviews loading, stopping scroll');
            break;
        }

        // Try to click "Show more" buttons if they exist
        try {
            const showMoreButton = await page.$('button[aria-label*="more" i], button[aria-label*="Show" i]');
            if (showMoreButton) {
                await showMoreButton.click();
                console.log('Clicked show more button');
                await wait(2000);
            }
        } catch (e) {
            // No show more button found
        }
    }

    console.log(`Finished scrolling. Total reviews loaded: ${currentCount}`);
    return currentCount;
} 