import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { scrapeWithOutscraper, testOutscraperAPI } from '../services/outscraperService';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

// Test Outscraper API connection
router.get('/test-outscraper', async (req, res) => {
    console.log('🎯 Test-outscraper route called!');
    try {
        console.log('📞 Calling testOutscraperAPI...');
        const result = await testOutscraperAPI();
        console.log('✅ testOutscraperAPI returned:', result);
        res.json(result);
    } catch (error) {
        console.error('❌ Route error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Test route to verify the database connection
router.post('/test', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .limit(1);

        if (error) throw error;

        res.json({ success: true, project: data[0] });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Create new project and scrape with Outscraper
router.post('/', authenticateUser, async (req, res) => {
    try {
        const { name, description, googleUrl, maxReviews = 1000 } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        // Create project with user_id
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .insert([{
                name,
                description: description || '',
                status: 'pending',
                user_id: req.user!.id
            }])
            .select()
            .single();

        if (projectError) throw projectError;

        let scrapingResult = null;

        // If Google URL provided, start scraping with Outscraper
        if (googleUrl) {
            console.log('🚀 Starting Outscraper review collection for project:', project.id);

            await supabase
                .from('projects')
                .update({ status: 'processing' })
                .eq('id', project.id);

            // Use Outscraper for comprehensive review collection
            scrapingResult = await scrapeWithOutscraper(googleUrl, project.id, maxReviews);

            const finalStatus = scrapingResult.success ? 'completed' : 'error';
            const reviewCount = scrapingResult.reviews?.length || 0;

            await supabase
                .from('projects')
                .update({
                    status: finalStatus,
                    total_reviews: reviewCount,
                    analyzed_reviews: 0
                })
                .eq('id', project.id);
        }

        res.json({
            success: true,
            project,
            scraping: scrapingResult
        });

    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get all projects for authenticated user
router.get('/', authenticateUser, async (req, res) => {
    try {
        const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', req.user!.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, projects });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get project details with review count
router.get('/:projectId', authenticateUser, async (req, res) => {
    try {
        const { projectId } = req.params;

        // Get project with review counts (only for the authenticated user)
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .eq('user_id', req.user!.id)
            .single();

        if (projectError) throw projectError;

        // Get actual review counts
        const { count: totalReviews } = await supabase
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId);

        const { count: analyzedReviews } = await supabase
            .from('review_analyses')
            .select(`
                reviews!inner(project_id)
            `, { count: 'exact', head: true })
            .eq('reviews.project_id', projectId);

        // Update project with accurate counts
        await supabase
            .from('projects')
            .update({
                total_reviews: totalReviews || 0,
                analyzed_reviews: analyzedReviews || 0
            })
            .eq('id', projectId);

        res.json({
            success: true,
            project: {
                ...project,
                total_reviews: totalReviews || 0,
                analyzed_reviews: analyzedReviews || 0
            }
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete project
router.delete('/:projectId', authenticateUser, async (req, res) => {
    try {
        const { projectId } = req.params;

        // Delete project (only if owned by authenticated user)
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId)
            .eq('user_id', req.user!.id);

        if (error) throw error;

        res.json({ success: true, message: 'Project deleted successfully' });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export { router as projectRoutes };
export default router; 