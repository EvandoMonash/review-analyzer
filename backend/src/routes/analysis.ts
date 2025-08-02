import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { analyzeReview, batchAnalyzeReviewsFast, batchAnalyzeReviewsUltraFast } from '../services/openaiService';

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Analyze all reviews in a project
router.post('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get all reviews for this project that don't have analysis yet
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select(`
        id, 
        original_text, 
        rating,
        review_analyses!left(id)
      `)
      .eq('project_id', projectId);

    if (reviewsError) throw reviewsError;

    if (!reviews || reviews.length === 0) {
      return res.json({ success: true, message: 'No reviews found', reviewCount: 0 });
    }

    // Filter out reviews that already have analysis
    const unanalyzedReviews = reviews.filter(review =>
      !review.review_analyses || review.review_analyses.length === 0
    );

    // Apply smart filtering to skip low-value reviews
    const filteredReviews = filterReviewsForAnalysis(unanalyzedReviews);
    const skippedCount = unanalyzedReviews.length - filteredReviews.length;

    if (filteredReviews.length === 0) {
      return res.json({ 
        success: true, 
        message: `All ${unanalyzedReviews.length} reviews already analyzed or filtered out`, 
        reviewCount: 0,
        skipped: skippedCount
      });
    }

    console.log(`Starting AI analysis for ${filteredReviews.length} reviews in project ${projectId} (skipped ${skippedCount} low-value reviews: spam, too short, or mostly symbols)`);

    // Update project status to processing
    await supabase
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId);

    let analyzedCount = 0;

    // Prepare reviews for batch analysis
    const reviewsForAnalysis = filteredReviews.map(review => ({
      id: review.id,
      text: review.original_text,
      rating: review.rating
    }));

    console.log(`🚀 Starting FAST batch analysis for ${reviewsForAnalysis.length} reviews...`);

    // Use fast batch analysis (10 concurrent requests for much faster processing)
    const analysisResults = await batchAnalyzeReviewsFast(reviewsForAnalysis, 10);

    console.log(`✅ Analysis complete! Processing ${analysisResults.length} results...`);

    // Save all analysis results to database
    for (const result of analysisResults) {
      try {
        const { error: analysisError } = await supabase
          .from('review_analyses')
          .insert([{
            review_id: result.id,
            primary_category: result.analysis.primary_category,
            primary_confidence: result.analysis.primary_confidence,
            secondary_categories: result.analysis.secondary_categories,
            themes: result.analysis.themes,
            sentiment_score: result.analysis.sentiment_score,
            key_phrases: result.analysis.key_phrases,
            summary: result.analysis.summary,
            analysis_metadata: {
              model_used: 'gpt-3.5-turbo',
              analysis_date: new Date().toISOString(),
              processing_time: 0
            }
          }]);

        if (!analysisError) {
          analyzedCount++;

          // Update progress every 10 reviews (less frequent updates)
          if (analyzedCount % 10 === 0) {
            await supabase
              .from('projects')
              .update({ analyzed_reviews: analyzedCount })
              .eq('id', projectId);
          }
        } else {
          console.error(`Error saving analysis for review ${result.id}:`, analysisError);
        }

      } catch (error) {
        console.error(`Error saving analysis for review ${result.id}:`, error);
      }
    }

    // Update final project status
    await supabase
      .from('projects')
      .update({
        status: 'completed',
        analyzed_reviews: analyzedCount
      })
      .eq('id', projectId);

    res.json({
      success: true,
      message: `Successfully analyzed ${analyzedCount} reviews (skipped ${skippedCount} low-value reviews for faster processing)`,
      reviewCount: analyzedCount,
      skippedCount: skippedCount,
      totalReviews: unanalyzedReviews.length
    });

  } catch (error) {
    console.error('Error in project analysis:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get analysis summary for a project
router.get('/project/:projectId/summary', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get analysis summary with proper join
    const { data: analyses, error } = await supabase
      .from('review_analyses')
      .select(`
        primary_category,
        sentiment_score,
        themes,
        secondary_categories,
        reviews!inner(project_id)
      `)
      .eq('reviews.project_id', projectId);

    if (error) throw error;

    if (!analyses || analyses.length === 0) {
      return res.json({
        success: true,
        summary: {
          total: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          avgSentiment: 0,
          commonThemes: []
        }
      });
    }

    // Calculate summary statistics
    const summary = {
      total: analyses.length,
      positive: analyses.filter(a => a.primary_category === 'positive').length,
      negative: analyses.filter(a => a.primary_category === 'negative').length,
      neutral: analyses.filter(a => a.primary_category === 'neutral').length,
      avgSentiment: analyses.length > 0 ? analyses.reduce((sum, a) => sum + a.sentiment_score, 0) / analyses.length : 0,
      commonThemes: getTopThemes(analyses)
    };

    res.json({ success: true, summary });

  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get recent analyses for a project
router.get('/project/:projectId/recent', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: analyses, error } = await supabase
      .from('review_analyses')
      .select(`
        id,
        primary_category,
        primary_confidence,
        sentiment_score,
        themes,
        key_phrases,
        summary,
        reviews!inner(
          original_text,
          rating,
          author_name,
          project_id
        )
      `)
      .eq('reviews.project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({ success: true, analyses: analyses || [] });

  } catch (error) {
    console.error('Error fetching recent analyses:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get detailed analytics for a project
router.get('/project/:projectId/detailed', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get all analyses for this project
    const { data: analyses, error } = await supabase
      .from('review_analyses')
      .select(`
        primary_category,
        primary_confidence,
        sentiment_score,
        themes,
        secondary_categories,
        reviews!inner(
          rating,
          project_id
        )
      `)
      .eq('reviews.project_id', projectId);

    if (error) throw error;

    if (!analyses || analyses.length === 0) {
      return res.json({ success: true, analytics: null });
    }

    // Calculate detailed analytics
    const analytics = {
      overview: {
        total: analyses.length,
        positive: analyses.filter(a => a.primary_category === 'positive').length,
        negative: analyses.filter(a => a.primary_category === 'negative').length,
        neutral: analyses.filter(a => a.primary_category === 'neutral').length,
        avgSentiment: analyses.reduce((sum, a) => sum + a.sentiment_score, 0) / analyses.length,
        avgConfidence: analyses.reduce((sum, a) => sum + a.primary_confidence, 0) / analyses.length
      },
      ratingDistribution: getRatingDistribution(analyses),
      sentimentByRating: getSentimentByRating(analyses),
      topThemes: getTopThemes(analyses),
      themesBySentiment: getThemesBySentiment(analyses)
    };

    res.json({ success: true, analytics });

  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Ultra-fast analysis for a project
router.post('/project/:projectId/ultra-fast', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get all reviews for this project that don't have analysis yet
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select(`
        id, 
        original_text, 
        rating,
        review_analyses!left(id)
      `)
      .eq('project_id', projectId);

    if (reviewsError) throw reviewsError;

    if (!reviews || reviews.length === 0) {
      return res.json({ success: true, message: 'No reviews found', reviewCount: 0 });
    }

    // Filter out reviews that already have analysis
    const unanalyzedReviews = reviews.filter(review =>
      !review.review_analyses || review.review_analyses.length === 0
    );

    // Apply smart filtering to skip low-value reviews
    const filteredReviews = filterReviewsForAnalysis(unanalyzedReviews);
    const skippedCount = unanalyzedReviews.length - filteredReviews.length;

    if (filteredReviews.length === 0) {
      return res.json({ 
        success: true, 
        message: `All ${unanalyzedReviews.length} reviews already analyzed or filtered out`, 
        reviewCount: 0,
        skipped: skippedCount
      });
    }

    console.log(`Starting ultra-fast AI analysis for ${filteredReviews.length} reviews in project ${projectId} (skipped ${skippedCount} low-value reviews)`);

    // Update project status to processing
    await supabase
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId);

    let analyzedCount = 0;

    // Prepare reviews for batch analysis
    const reviewsForAnalysis = filteredReviews.map(review => ({
      id: review.id,
      text: review.original_text,
      rating: review.rating
    }));

    console.log(`🚀 Starting ULTRA-FAST batch analysis for ${reviewsForAnalysis.length} reviews...`);

    // Use fast batch analysis (10 concurrent requests for much faster processing)
    const analysisResults = await batchAnalyzeReviewsUltraFast(reviewsForAnalysis, 10);

    console.log(`✅ Analysis complete! Processing ${analysisResults.length} results...`);

    // Save all analysis results to database
    for (const result of analysisResults) {
      try {
        const { error: analysisError } = await supabase
          .from('review_analyses')
          .insert([{
            review_id: result.id,
            primary_category: result.analysis.primary_category,
            primary_confidence: result.analysis.primary_confidence,
            secondary_categories: result.analysis.secondary_categories,
            themes: result.analysis.themes,
            sentiment_score: result.analysis.sentiment_score,
            key_phrases: result.analysis.key_phrases,
            summary: result.analysis.summary,
            analysis_metadata: {
              model_used: 'gpt-3.5-turbo',
              analysis_date: new Date().toISOString(),
              processing_time: 0
            }
          }]);

        if (!analysisError) {
          analyzedCount++;

          // Update progress every 10 reviews (less frequent updates)
          if (analyzedCount % 10 === 0) {
            await supabase
              .from('projects')
              .update({ analyzed_reviews: analyzedCount })
              .eq('id', projectId);
          }
        } else {
          console.error(`Error saving analysis for review ${result.id}:`, analysisError);
        }

      } catch (error) {
        console.error(`Error saving analysis for review ${result.id}:`, error);
      }
    }

    // Update final project status
    await supabase
      .from('projects')
      .update({
        status: 'completed',
        analyzed_reviews: analyzedCount
      })
      .eq('id', projectId);

    res.json({
      success: true,
      message: `Successfully analyzed ${analyzedCount} reviews`,
      reviewCount: analyzedCount
    });

  } catch (error) {
    console.error('Error in ultra-fast project analysis:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Helper functions
function getTopThemes(analyses: any[]) {
  const themeCount: { [key: string]: number } = {};

  analyses.forEach(analysis => {
    if (analysis.themes) {
      analysis.themes.forEach((theme: string) => {
        themeCount[theme] = (themeCount[theme] || 0) + 1;
      });
    }
  });

  return Object.entries(themeCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([theme, count]) => ({ theme, count }));
}

function getRatingDistribution(analyses: any[]) {
  const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  analyses.forEach(analysis => {
    const rating = analysis.reviews?.rating || 3;
    distribution[rating] = (distribution[rating] || 0) + 1;
  });

  return Object.entries(distribution).map(([rating, count]) => ({
    rating: parseInt(rating),
    count
  }));
}

function getSentimentByRating(analyses: any[]) {
  const sentimentByRating: { [key: number]: { positive: number; negative: number; neutral: number } } = {
    1: { positive: 0, negative: 0, neutral: 0 },
    2: { positive: 0, negative: 0, neutral: 0 },
    3: { positive: 0, negative: 0, neutral: 0 },
    4: { positive: 0, negative: 0, neutral: 0 },
    5: { positive: 0, negative: 0, neutral: 0 }
  };

  analyses.forEach(analysis => {
    const rating = analysis.reviews?.rating || 3;
    const sentiment = analysis.primary_category;

    if (sentimentByRating[rating] && sentiment) {
      const sentimentKey = sentiment as 'positive' | 'negative' | 'neutral';
      sentimentByRating[rating][sentimentKey]++;
    }
  });

  return Object.entries(sentimentByRating).map(([rating, sentiments]) => ({
    rating: parseInt(rating),
    ...sentiments
  }));
}

function getThemesBySentiment(analyses: any[]) {
  const themesBySentiment: { [theme: string]: { positive: number; negative: number; neutral: number } } = {};

  analyses.forEach(analysis => {
    const sentiment = analysis.primary_category as 'positive' | 'negative' | 'neutral';
    if (analysis.themes) {
      analysis.themes.forEach((theme: string) => {
        if (!themesBySentiment[theme]) {
          themesBySentiment[theme] = { positive: 0, negative: 0, neutral: 0 };
        }
        if (sentiment && (sentiment === 'positive' || sentiment === 'negative' || sentiment === 'neutral')) {
          themesBySentiment[theme][sentiment]++;
        }
      });
    }
  });

  return Object.entries(themesBySentiment)
    .map(([theme, sentiments]) => ({
      theme,
      ...sentiments,
      total: sentiments.positive + sentiments.negative + sentiments.neutral
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function filterReviewsForAnalysis(reviews: any[]): any[] {
  return reviews.filter(review => {
    const text = review.original_text?.toLowerCase() || '';

    // Skip very short reviews (less than 10 characters)
    if (text.length < 10) return false;

    // Skip common spam/generic reviews
    const spamPatterns = [
      'good', 'bad', 'ok', 'nice', 'great', 'terrible', 'awful',
      'thumbs up', '👍', '👎', 'like', 'dislike'
    ];

    if (spamPatterns.some(pattern => text === pattern)) return false;

    // Skip reviews that are mostly numbers or symbols
    if (text.replace(/[^a-z]/g, '').length < 5) return false;

    return true;
  });
}

export { router as analysisRoutes };