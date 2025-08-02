import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { reviewRoutes } from './routes/reviews';
import { analysisRoutes } from './routes/analysis';
import { projectRoutes } from './routes/projects';
import authRoutes from './routes/auth';

const app = express();
const PORT = process.env.PORT || 3002; // Railway will provide PORT, fallback to 3002 for local

// CORS configuration for production
app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'https://your-app.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/projects', projectRoutes);

// Add root route
app.get('/', (req, res) => {
    res.json({
        message: 'Review Analyzer API',
        endpoints: [
            'GET /health',
            'POST /api/projects/test',
            'POST /api/reviews/test'
        ]
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 