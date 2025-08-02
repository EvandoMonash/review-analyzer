'use client';

import React, { useState } from 'react';
import { Upload, BarChart3, FileText, Sparkles, User, LogOut } from 'lucide-react';
import UploadSection from '@/components/UploadSection';
import ProjectList from '@/components/ProjectList';
import AnalysisDashboard from '@/components/AnalysisDashboard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

function MainApp() {
  const [activeTab, setActiveTab] = useState<'upload' | 'projects' | 'analytics'>('upload');
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <ProtectedRoute>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {/* Header */}
        <header style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <div style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                padding: '8px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                borderRadius: '12px'
              }}>
                <Sparkles style={{ width: '24px', height: '24px', color: '#ffffff' }} />
              </div>
              <div>
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                  margin: 0
                }}>
                  Review Analyzer
                </h1>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>
                  AI-Powered Review Intelligence
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                color: '#6b7280'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#10b981',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }}></div>
                <span>AI Ready</span>
              </div>

              {/* User Info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 16px',
                backgroundColor: '#F3F4F6',
                borderRadius: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: '#3B82F6',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User style={{ width: '16px', height: '16px', color: '#FFFFFF' }} />
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#111827'
                    }}>
                      {user?.name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      {user?.email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '6px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#6B7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Logout"
                >
                  <LogOut style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Simple Tab Navigation */}
        <nav style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '24px'
        }}>
          <div style={{
            display: 'inline-flex',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            padding: '4px'
          }}>
            <button
              onClick={() => setActiveTab('upload')}
              style={{
                padding: '8px 24px',
                fontSize: '14px',
                fontWeight: '500',
                color: activeTab === 'upload' ? '#ffffff' : '#374151',
                backgroundColor: activeTab === 'upload' ? '#000000' : 'transparent',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Create New
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              style={{
                padding: '8px 24px',
                fontSize: '14px',
                fontWeight: '500',
                color: activeTab === 'projects' ? '#ffffff' : '#374151',
                backgroundColor: activeTab === 'projects' ? '#000000' : 'transparent',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              List of Projects
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                padding: '8px 24px',
                fontSize: '14px',
                fontWeight: '500',
                color: activeTab === 'analytics' ? '#ffffff' : '#374151',
                backgroundColor: activeTab === 'analytics' ? '#000000' : 'transparent',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Analyse Results
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px 48px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            {activeTab === 'upload' && <UploadSection onProjectCreated={() => setActiveTab('projects')} />}
            {activeTab === 'projects' && <ProjectList />}
            {activeTab === 'analytics' && <AnalysisDashboard />}
          </div>
        </main>

        <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
            `}</style>
      </div>
    </ProtectedRoute>
  );
}

export default function Home() {
  return <MainApp />;
} 