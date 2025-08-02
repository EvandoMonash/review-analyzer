export interface Review {
    id: string;
    original_text: string;
    rating: number;
    author_name?: string;
    date?: string;
    source: 'csv' | 'google_url';
    created_at: string;
    updated_at: string;
}

export interface ReviewAnalysis {
    id: string;
    review_id: string;
    primary_category: 'positive' | 'negative' | 'neutral';
    primary_confidence: number;
    secondary_categories: string[];
    themes: string[];
    sentiment_score: number;
    key_phrases: string[];
    summary: string;
    analysis_metadata: {
        model_used: string;
        analysis_date: string;
        processing_time: number;
    };
}

export interface AnalysisProject {
    id: string;
    name: string;
    description?: string;
    total_reviews: number;
    analyzed_reviews: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
    created_at: string;
    updated_at: string;
}

export interface CategoryBreakdown {
    positive: {
        count: number;
        percentage: number;
        themes: { theme: string; count: number }[];
    };
    negative: {
        count: number;
        percentage: number;
        themes: { theme: string; count: number }[];
    };
    neutral: {
        count: number;
        percentage: number;
        themes: { theme: string; count: number }[];
    };
} 