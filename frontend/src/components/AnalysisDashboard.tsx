'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Users, Star, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Project {
  id: string;
  name: string;
  total_reviews: number;
  analyzed_reviews: number;
  status: string;
}

interface AnalysisSummary {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  avgSentiment: number;
  commonThemes: { theme: string; count: number }[];
}

interface ReviewAnalysis {
  id: string;
  primary_category: string;
  primary_confidence: number;
  sentiment_score: number;
  themes: string[];
  key_phrases: string[];
  summary: string;
  reviews: {
    original_text: string;
    rating: number;
    author_name: string;
    project_id: string;
  };
}

export default function AnalysisDashboard() {
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<ReviewAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchProjects();
    }
  }, [session]);

  useEffect(() => {
    if (selectedProject) {
      fetchAnalysisData();
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    if (!session) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/projects`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        // Filter to only show projects that have analyzed reviews
        const analyzedProjects = data.projects.filter((p: Project) => p.analyzed_reviews > 0);
        setProjects(analyzedProjects);

        // Auto-select first project with analyses
        if (analyzedProjects.length > 0 && !selectedProject) {
          setSelectedProject(analyzedProjects[0].id);
        }

        console.log('Loaded', analyzedProjects.length, 'projects with analysis data');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysisData = async () => {
    if (!selectedProject) return;

    try {
      setLoading(true);
      setSummary(null);
      setRecentAnalyses([]);

      // Fetch analysis summary
      const summaryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/analysis/project/${selectedProject}/summary`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      const summaryData = await summaryResponse.json();

      if (summaryData.success && summaryData.summary) {
        setSummary(summaryData.summary);
        console.log('Analysis summary loaded:', summaryData.summary);
      } else {
        console.log('No summary data available:', summaryData.message);
      }

      // Fetch recent analyses
      const analysesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/analysis/project/${selectedProject}/recent`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      const analysesData = await analysesResponse.json();

      if (analysesData.success && analysesData.analyses) {
        setRecentAnalyses(analysesData.analyses);
        console.log('Recent analyses loaded:', analysesData.analyses.length, 'items');
      } else {
        console.log('No recent analyses available:', analysesData.message);
      }

    } catch (error) {
      console.error('Error fetching analysis data:', error);
      setSummary(null);
      setRecentAnalyses([]);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (score: number) => {
    if (score >= 0.6) return '#16A34A'; // green
    if (score >= 0.3) return '#EAB308'; // yellow
    return '#EF4444'; // red
  };

  const formatSentimentLabel = (score: number) => {
    if (score >= 0.6) return 'Positive';
    if (score >= 0.3) return 'Neutral';
    return 'Negative';
  };

  const pieData = summary ? [
    { name: 'Positive', value: summary.positive, color: '#16A34A' },
    { name: 'Neutral', value: summary.neutral, color: '#EAB308' },
    { name: 'Negative', value: summary.negative, color: '#EF4444' }
  ] : [];

  const barData = summary?.commonThemes?.slice(0, 5).map(theme => ({
    theme: theme.theme.length > 15 ? theme.theme.substring(0, 15) + '...' : theme.theme,
    count: theme.count
  })) || [];

  if (loading && !selectedProject) {
    return (
      <div style={{
        padding: '32px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '2px solid #111827',
          borderTop: '2px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }}></div>
        <p style={{ color: '#6B7280' }}>Loading projects...</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '32px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header Section */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#2563EB',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <BarChart3 style={{ width: '32px', height: '32px', color: '#FFFFFF' }} />
        </div>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#111827',
          marginBottom: '12px',
          margin: '0 0 12px 0'
        }}>
          Analysis Results
        </h2>
        <p style={{
          color: '#6B7280',
          fontSize: '16px',
          lineHeight: '1.5',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          View detailed analytics and insights from your review analysis. Get comprehensive reports on sentiment, trends, and customer feedback patterns.
        </p>
      </div>

      {projects.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          padding: '48px',
          textAlign: 'center'
        }}>
          <BarChart3 style={{ width: '48px', height: '48px', color: '#9CA3AF', margin: '0 auto 16px' }} />
          <h3 style={{
            fontSize: '18px',
            fontWeight: '500',
            color: '#111827',
            marginBottom: '8px'
          }}>
            No Analysis Data Available
          </h3>
          <p style={{
            color: '#6B7280',
            marginBottom: '16px'
          }}>
            No projects with analyzed reviews found. Please analyze some reviews first to view insights here.
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#F3F4F6',
            color: '#374151',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            💡 Go to "List of Projects" to analyze your reviews
          </div>
        </div>
      ) : (
        <>
          {/* Project Selection */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '8px',
                  margin: '0 0 8px 0'
                }}>
                  Select Project
                </h3>
                <p style={{
                  color: '#6B7280',
                  fontSize: '14px',
                  margin: '0'
                }}>
                  Choose a project to view its analysis results
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    minWidth: '200px'
                  }}
                >
                  <option value="">Select a project...</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.analyzed_reviews}/{project.total_reviews} analyzed)
                    </option>
                  ))}
                </select>
                <button
                  onClick={fetchAnalysisData}
                  disabled={!selectedProject || loading}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    cursor: selectedProject && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: selectedProject && !loading ? '1' : '0.5'
                  }}
                >
                  <RefreshCw style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              padding: '48px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '2px solid #111827',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}></div>
              <p style={{ color: '#6B7280' }}>Loading analysis data...</p>
            </div>
          ) : !summary ? (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              padding: '48px',
              textAlign: 'center'
            }}>
              <AlertCircle style={{ width: '48px', height: '48px', color: '#9CA3AF', margin: '0 auto 16px' }} />
              <h3 style={{
                fontSize: '18px',
                fontWeight: '500',
                color: '#111827',
                marginBottom: '8px'
              }}>
                No Analysis Data
              </h3>
              <p style={{
                color: '#6B7280',
                marginBottom: '16px'
              }}>
                {selectedProject ? 'This project has no analyzed reviews yet.' : 'Please select a project to view its analysis.'}
              </p>
              {selectedProject && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  ⚡ Run analysis on this project to see insights
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Summary Stats Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '24px',
                marginBottom: '32px'
              }}>
                {/* Total Reviews */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>Total Reviews</div>
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#DBEAFE',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Users style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: '700', color: '#111827' }}>{summary.total}</div>
                </div>

                {/* Average Sentiment */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>Avg Sentiment</div>
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#FED7AA',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <TrendingUp style={{ width: '20px', height: '20px', color: '#EA580C' }} />
                    </div>
                  </div>
                  <div style={{
                    fontSize: '30px',
                    fontWeight: '700',
                    color: getSentimentColor(summary.avgSentiment)
                  }}>
                    {(summary.avgSentiment * 100).toFixed(0)}%
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: getSentimentColor(summary.avgSentiment),
                    fontWeight: '500'
                  }}>
                    {formatSentimentLabel(summary.avgSentiment)}
                  </div>
                </div>

                {/* Positive Reviews */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>Positive</div>
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#BBF7D0',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CheckCircle style={{ width: '20px', height: '20px', color: '#16A34A' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: '700', color: '#111827' }}>{summary.positive}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {summary.total > 0 ? Math.round((summary.positive / summary.total) * 100) : 0}% of total
                  </div>
                </div>

                {/* Negative Reviews */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>Negative</div>
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#FECACA',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <AlertCircle style={{ width: '20px', height: '20px', color: '#DC2626' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: '700', color: '#111827' }}>{summary.negative}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {summary.total > 0 ? Math.round((summary.negative / summary.total) * 100) : 0}% of total
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px',
                marginBottom: '32px'
              }}>
                {/* Sentiment Distribution Chart */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '24px'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '16px',
                    margin: '0 0 16px 0'
                  }}>
                    Sentiment Distribution
                  </h3>
                  <div style={{
                    width: '100%',
                    height: '300px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {summary && summary.total > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Positive', value: summary.positive, fill: '#16A34A' },
                              { name: 'Neutral', value: summary.neutral, fill: '#EAB308' },
                              { name: 'Negative', value: summary.negative, fill: '#EF4444' }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            <Cell fill="#16A34A" />
                            <Cell fill="#EAB308" />
                            <Cell fill="#EF4444" />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: '#6B7280',
                        fontSize: '14px'
                      }}>
                        {loading ? 'Loading sentiment data...' : 'No sentiment analysis available'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Common Themes Chart */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '24px'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '16px',
                    margin: '0 0 16px 0'
                  }}>
                    Top Themes
                  </h3>
                  <div style={{
                    width: '100%',
                    height: '300px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {summary && summary.commonThemes && summary.commonThemes.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={summary.commonThemes.slice(0, 5).map(theme => ({
                            theme: theme.theme.length > 15 ? theme.theme.substring(0, 15) + '...' : theme.theme,
                            count: theme.count
                          }))}
                          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="theme"
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#2563EB" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: '#6B7280',
                        fontSize: '14px'
                      }}>
                        {loading ? 'Loading themes data...' : 'No common themes found'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Analyses */}
              {recentAnalyses.length > 0 && (
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '24px', borderBottom: '1px solid #E5E7EB' }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#111827',
                      margin: '0'
                    }}>
                      Recent Review Analyses
                    </h3>
                  </div>
                  <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                    {recentAnalyses.slice(0, 5).map((analysis, index) => (
                      <div
                        key={analysis.id}
                        style={{
                          padding: '16px 24px',
                          borderBottom: index < recentAnalyses.length - 1 ? '1px solid #E5E7EB' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#111827',
                              marginBottom: '4px'
                            }}>
                              {analysis.reviews.author_name || 'Anonymous'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      color: i < analysis.reviews.rating ? '#EAB308' : '#E5E7EB',
                                      fill: i < analysis.reviews.rating ? '#EAB308' : '#E5E7EB'
                                    }}
                                  />
                                ))}
                              </div>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 6px',
                                fontSize: '11px',
                                fontWeight: '500',
                                borderRadius: '9999px',
                                backgroundColor: getSentimentColor(analysis.sentiment_score) + '20',
                                color: getSentimentColor(analysis.sentiment_score)
                              }}>
                                {formatSentimentLabel(analysis.sentiment_score)}
                              </span>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#6B7280',
                            textAlign: 'right'
                          }}>
                            {analysis.primary_category}
                          </div>
                        </div>
                        <p style={{
                          fontSize: '14px',
                          color: '#374151',
                          marginBottom: '8px',
                          lineHeight: '1.4'
                        }}>
                          {analysis.reviews.original_text.length > 200
                            ? analysis.reviews.original_text.substring(0, 200) + '...'
                            : analysis.reviews.original_text
                          }
                        </p>
                        {analysis.themes.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {analysis.themes.slice(0, 3).map((theme, themeIndex) => (
                              <span
                                key={themeIndex}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  backgroundColor: '#F3F4F6',
                                  color: '#374151',
                                  borderRadius: '9999px'
                                }}
                              >
                                {theme}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
} 