import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

export async function scrapeAllGoogleReviews(url: string, projectId: string): Promise<{ success: boolean; reviews?: any[]; error?: string }> {
    let browser;

    try {
        console.log('Starting comprehensive Google Reviews scraping for:', url);

        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        // Navigate to reviews directly
        let reviewsUrl = url;
        if (!url.includes('/reviews')) {
            reviewsUrl = url.replace('/@', '/reviews/@');
        }

        console.log('Navigating to reviews URL:', reviewsUrl);
        await page.goto(reviewsUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Try multiple strategies to load ALL reviews
        console.log('Loading all reviews with multiple strategies...');

        // Strategy 1: Aggressive scrolling with container detection
        await loadAllReviewsAggressive(page);

        // Strategy 2: Try to find and manipulate pagination
        await handlePagination(page);

        // Extract all reviews
        const reviews = await page.evaluate(() => {
            const extractedReviews: any[] = [];

            // Try multiple selectors for review containers
            const selectors = [
                '.jftiEf',
                '.MyEned',
                '.ODSEW-ShBeI',
                '[data-review-id]',
                'div[data-reviewid]',
                '.WNxzHc',
                '.gws-localreviews__google-review'
            ];

            let reviewElements: NodeListOf<Element> | null = null;

            for (const selector of selectors) {
                reviewElements = document.querySelectorAll(selector);
                if (reviewElements.length > 0) {
                    console.log(`Found ${reviewElements.length} reviews with selector: ${selector}`);
                    break;
                }
            }

            if (!reviewElements || reviewElements.length === 0) {
                console.log('No review elements found with any selector');
                return [];
            }

            reviewElements.forEach((reviewElement, index) => {
                try {
                    // More aggressive text extraction
                    let text = '';
                    const textSelectors = [
                        '.wiI7pd',
                        '.MyEned',
                        '[data-expandable-section]',
                        '.rsqaWe',
                        'span[jsaction]',
                        '.review-text',
                        '.expanded-review'
                    ];

                    for (const selector of textSelectors) {
                        const textElement = reviewElement.querySelector(selector);
                        if (textElement && textElement.textContent) {
                            const foundText = textElement.textContent.trim();
                            if (foundText.length > text.length) {
                                text = foundText;
                            }
                        }
                    }

                    // Extract rating more aggressively
                    let rating = 0;
                    const ratingSelectors = [
                        '[role="img"][aria-label*="star"]',
                        '[aria-label*="star"]',
                        '.kvMYJc',
                        '[data-value]'
                    ];

                    for (const selector of ratingSelectors) {
                        const ratingElement = reviewElement.querySelector(selector);
                        if (ratingElement) {
                            const ariaLabel = ratingElement.getAttribute('aria-label') || '';
                            const ratingMatch = ariaLabel.match(/(\d+)\s*star/i);
                            if (ratingMatch) {
                                rating = parseInt(ratingMatch[1]);
                                break;
                            }
                        }
                    }

                    // Extract author
                    let author_name = 'Anonymous';
                    const authorSelectors = [
                        '.d4r55',
                        '.TSUbDb',
                        '.YOGjf',
                        '[data-value="Name"]',
                        '.review-author'
                    ];

                    for (const selector of authorSelectors) {
                        const authorElement = reviewElement.querySelector(selector);
                        if (authorElement && authorElement.textContent) {
                            author_name = authorElement.textContent.trim();
                            break;
                        }
                    }

                    if (text && text.length > 5) {
                        if (rating === 0) rating = 3;

                        extractedReviews.push({
                            text,
                            rating,
                            author_name,
                            date: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    console.error(`Error extracting review ${index}:`, error);
                }
            });

            return extractedReviews;
        });

        console.log(`Successfully extracted ${reviews.length} reviews`);

        if (reviews.length === 0) {
            return { success: false, error: 'No reviews found with improved scraping' };
        }

        // Save to database
        const reviewInserts = reviews.map(review => ({
            project_id: projectId,
            original_text: review.text,
            rating: review.rating,
            author_name: review.author_name,
            review_date: new Date().toISOString().split('T')[0],
            source: 'google_scraping_improved'
        }));

        const { data: savedReviews, error: insertError } = await supabase
            .from('reviews')
            .insert(reviewInserts)
            .select();

        if (insertError) {
            return { success: false, error: 'Failed to save reviews' };
        }

        return { success: true, reviews: savedReviews };

    } catch (error) {
        console.error('Error in improved scraping:', error);
        return { success: false, error: `Scraping failed: ${(error as Error).message}` };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function loadAllReviewsAggressive(page: any) {
    // Super aggressive scrolling
    for (let i = 0; i < 100; i++) {
        await page.evaluate(() => {
            // Scroll main window
            window.scrollBy(0, 1000);

            // Find and scroll all possible containers
            const containers = document.querySelectorAll('div[style*="overflow"], div[style*="scroll"]');
            containers.forEach(container => {
                if (container.scrollHeight > container.clientHeight) {
                    container.scrollBy(0, 500);
                }
            });

            // Scroll specific Google Maps containers
            const gmapsContainers = document.querySelectorAll('.m6QErb, .section-scrollbox, .siAUzd-neVct');
            gmapsContainers.forEach(container => {
                container.scrollBy(0, 500);
            });
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to click load more buttons
        try {
            const loadMoreButtons = await page.$$('button, [role="button"]');
            for (const button of loadMoreButtons) {
                const text = await button.evaluate((el: Element) => el.textContent?.toLowerCase() || '');
                if (text.includes('more') || text.includes('show') || text.includes('load')) {
                    try {
                        await button.click();
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (e) {
                        // Button might not be clickable
                    }
                }
            }
        } catch (e) {
            // No more buttons found
        }
    }
}

async function handlePagination(page: any) {
    // Look for pagination controls and click through them
    for (let i = 0; i < 10; i++) {
        try {
            const nextButton = await page.$('button[aria-label*="Next"], a[aria-label*="Next"]');
            if (nextButton) {
                await nextButton.click();
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                break;
            }
        } catch (e) {
            break;
        }
    }
} 