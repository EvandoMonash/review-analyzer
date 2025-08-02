'use client';

import React, { useState } from 'react';
import { Upload, BarChart3, FileText, Sparkles, User, LogOut } from 'lucide-react';
import UploadSection from '@/components/UploadSection';
import ProjectList from '@/components/ProjectList';
import AnalysisDashboard from '@/components/AnalysisDashboard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

// Simple test without authentication
export default function Home() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Review Analyzer</h1>
      <p>Main page working! (Authentication temporarily disabled for testing)</p>
      <p>If you can see this, Next.js routing works fine.</p>
      <h3>Environment Variables:</h3>
      <ul>
        <li>API URL: {process.env.NEXT_PUBLIC_API_URL || 'NOT_SET'}</li>
        <li>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET'}</li>
      </ul>
      <p>Current time: {new Date().toISOString()}</p>
    </div>
  );
} 