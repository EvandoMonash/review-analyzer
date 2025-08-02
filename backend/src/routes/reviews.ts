import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { analyzeReview } from '../services/openaiService';

const router = Router();
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

// Add this new test route at the top of the file
router.get('/test-openai', async (req, res) => {
    try {
        console.log('Testing OpenAI connection...');
        console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
        console.log('API Key starts with sk-:', process.env.OPENAI_API_KEY?.startsWith('sk-'));

        const { analyzeReview } = await import('../services/openaiService');
        const result = await analyzeReview("This is a test review");
        res.json({ success: true, result });
    } catch (error) {
        console.error('OpenAI test failed:', error);
        res.json({ success: false, error: (error as Error).message });
    }
});

// Test endpoint: Add and analyze a review
router.post('/test', async (req, res) => {
    try {
        const { text, rating, project_id } = req.body;

        // 1. Insert review into database
        const { data: reviewData, error: reviewError } = await supabase
            .from('reviews')
            .insert([{
                project_id: project_id || null,
                original_text: text,
                rating: rating || null,
                source: 'csv'
            }])
            .select();

        if (reviewError) throw reviewError;

        // 2. Analyze with AI
        const analysis = await analyzeReview(text, rating);

        // 3. Save analysis
        const { data: analysisData, error: analysisError } = await supabase
            .from('review_analyses')
            .insert([{
                review_id: reviewData[0].id,
                primary_category: analysis.primary_category,
                primary_confidence: analysis.primary_confidence,
                secondary_categories: analysis.secondary_categories,
                themes: analysis.themes,
                sentiment_score: analysis.sentiment_score,
                key_phrases: analysis.key_phrases,
                summary: analysis.summary,
                analysis_metadata: {
                    model_used: 'gpt-4',
                    analysis_date: new Date().toISOString(),
                    processing_time: 0
                }
            }])
            .select();

        if (analysisError) throw analysisError;

        res.json({
            success: true,
            review: reviewData[0],
            analysis: analysisData[0]
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export { router as reviewRoutes }; 