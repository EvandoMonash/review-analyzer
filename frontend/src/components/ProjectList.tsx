'use client';

import React, { useState, useEffect } from 'react';
import {
    FileText, Clock, CheckCircle, AlertCircle, BarChart3, Trash2, RefreshCw,
    Search, Filter, Plus, Zap, Pause, Play, FolderOpen, Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Project {
    id: string;
    name: string;
    description?: string;
    total_reviews: number;
    analyzed_reviews: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
    created_at: string;
}

export default function ProjectList() {
    const { session } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analyzingProject, setAnalyzingProject] = useState<string | null>(null);
    const [deletingProject, setDeletingProject] = useState<string | null>(null);
    const [globalFilter, setGlobalFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<string>('');
    const [autoRefresh, setAutoRefresh] = useState(false);

    useEffect(() => {
        if (session) {
            fetchProjects();
        }
    }, [session]);

    useEffect(() => {
        if (!autoRefresh) return;

        // Use faster refresh rate when there are processing projects
        const hasProcessingProjects = projects.some(p => p.status === 'processing');
        const refreshInterval = hasProcessingProjects ? 2000 : 5000; // 2s when processing, 5s otherwise

        const interval = setInterval(() => {
            if (projects.some(p => p.status === 'processing')) {
                fetchProjects();
            } else if (hasProcessingProjects) {
                // If no more processing projects, we can slow down refresh
                fetchProjects();
            }
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, projects]);

    const fetchProjects = async () => {
        if (!session) return;

        try {
            setLoading(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/projects`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (data.success) {
                setProjects(data.projects);
                if (data.projects.some((p: Project) => p.status === 'processing') && !autoRefresh) {
                    setAutoRefresh(true);
                }
            } else {
                setError('Failed to load projects');
            }
        } catch (err) {
            setError('Error loading projects');
        } finally {
            setLoading(false);
        }
    };

    const analyzeProject = async (projectId: string, isUltraFast: boolean = false) => {
        try {
            setAnalyzingProject(projectId);

            // Start the analysis
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/analysis/project/${projectId}${isUltraFast ? '/ultra-fast' : ''}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const data = await response.json();

            if (data.success) {
                // Enable auto-refresh immediately to track progress
                setAutoRefresh(true);

                // Start polling for progress updates more frequently during analysis
                const progressInterval = setInterval(async () => {
                    try {
                        const progressResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/projects`, {
                            headers: {
                                'Authorization': `Bearer ${session?.access_token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        const progressData = await progressResponse.json();
                        if (progressData.success) {
                            const updatedProjects = progressData.projects;
                            const currentProject = updatedProjects.find((p: any) => p.id === projectId);

                            // Update projects state to reflect progress
                            setProjects(updatedProjects);

                            // If analysis is complete, stop polling and show success message
                            if (currentProject && currentProject.status === 'completed') {
                                clearInterval(progressInterval);
                                setAnalyzingProject(null);
                                const filteredCount = currentProject.total_reviews - currentProject.analyzed_reviews;
                                const filteredMessage = filteredCount > 0 ? ` (${filteredCount} low-quality reviews filtered out)` : '';
                                const message = isUltraFast
                                    ? `⚡ Ultra-fast analysis completed! ${currentProject.analyzed_reviews} reviews analyzed${filteredMessage}`
                                    : `🎉 Analysis completed! ${currentProject.analyzed_reviews} reviews analyzed${filteredMessage}`;
                                alert(message);
                            }
                            // If analysis failed, stop polling
                            else if (currentProject && currentProject.status === 'error') {
                                clearInterval(progressInterval);
                                setAnalyzingProject(null);
                                alert(`❌ Analysis failed for project: ${currentProject.name}`);
                            }
                        }
                    } catch (progressError) {
                        console.error('Error fetching progress:', progressError);
                    }
                }, 2000); // Poll every 2 seconds for more responsive progress updates

                // Set a timeout to stop polling after a reasonable time (e.g., 10 minutes)
                setTimeout(() => {
                    clearInterval(progressInterval);
                    if (analyzingProject === projectId) {
                        setAnalyzingProject(null);
                    }
                }, 600000); // 10 minutes timeout

            } else {
                alert(`❌ Analysis failed: ${data.error || 'Unknown error'}`);
                setAnalyzingProject(null);
            }
        } catch (error) {
            alert('Failed to start analysis');
            setAnalyzingProject(null);
        }
    };

    const deleteProject = async (projectId: string, projectName: string) => {
        if (!confirm(`Are you sure you want to delete "${projectName}"?`)) return;
        try {
            setDeletingProject(projectId);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (data.success) {
                setProjects(projects.filter(p => p.id !== projectId));
                setSelectedProjects(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(projectId);
                    return newSet;
                });
                alert('✅ Project deleted successfully');
            } else {
                alert('❌ Failed to delete project');
            }
        } catch (error) {
            alert('❌ Failed to delete project');
        } finally {
            setDeletingProject(null);
        }
    };

    const handleBulkAction = async () => {
        if (!bulkAction || selectedProjects.size === 0) return;
        const projectsToProcess = Array.from(selectedProjects);

        if (bulkAction === 'delete') {
            if (!confirm(`Delete ${projectsToProcess.length} selected projects?`)) return;
            for (const projectId of projectsToProcess) {
                const project = projects.find(p => p.id === projectId);
                if (project) await deleteProject(projectId, project.name);
            }
        } else if (bulkAction === 'analyze' || bulkAction === 'analyze-fast') {
            const isUltraFast = bulkAction === 'analyze-fast';

            // Start all analyses
            const analysisPromises = projectsToProcess.map(async (projectId) => {
                try {
                    const response = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/analysis/project/${projectId}${isUltraFast ? '/ultra-fast' : ''}`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${session?.access_token}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    const data = await response.json();
                    return { projectId, success: data.success, error: data.error };
                } catch (error) {
                    return { projectId, success: false, error: 'Network error' };
                }
            });

            // Wait for all analyses to start
            const results = await Promise.all(analysisPromises);
            const successfulAnalyses = results.filter(r => r.success);

            if (successfulAnalyses.length > 0) {
                // Enable auto-refresh to track progress of all analyses
                setAutoRefresh(true);
                alert(`✅ Started analysis for ${successfulAnalyses.length} projects. Progress will be tracked automatically.`);
            }

            // Report any failures
            const failures = results.filter(r => !r.success);
            if (failures.length > 0) {
                alert(`❌ Failed to start analysis for ${failures.length} projects.`);
            }
        }

        setSelectedProjects(new Set());
        setBulkAction('');
    };

    const toggleProjectSelection = (projectId: string) => {
        setSelectedProjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedProjects.size === filteredProjects.length && filteredProjects.length > 0) {
            setSelectedProjects(new Set());
        } else {
            setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
        }
    };

    // Helper function to determine the display status based on analysis state
    const getDisplayStatus = (project: any) => {
        if (project.status === 'error') {
            return 'On Hold';
        } else if (project.analyzed_reviews > 0) {
            return 'Completed';
        } else {
            return 'In Progress';
        }
    };

    // Helper function to get status styling
    const getStatusStyling = (project: any) => {
        const displayStatus = getDisplayStatus(project);

        if (displayStatus === 'On Hold') {
            return {
                backgroundColor: '#FEE2E2',
                color: '#991B1B'
            };
        } else if (displayStatus === 'Completed') {
            return {
                backgroundColor: '#000000',
                color: '#FFFFFF'
            };
        } else {
            return {
                backgroundColor: '#FEF3C7',
                color: '#92400E'
            };
        }
    };

    const filteredProjects = projects.filter(project =>
        (statusFilter === 'all' || getDisplayStatus(project) === statusFilter) &&
        (project.name.toLowerCase().includes(globalFilter.toLowerCase()))
    );

    const completedProjects = projects.filter(p => getDisplayStatus(p) === 'Completed').length;
    const processingProjects = projects.filter(p => getDisplayStatus(p) === 'In Progress').length;
    const errorProjects = projects.filter(p => getDisplayStatus(p) === 'On Hold').length;

    if (loading) {
        return (
            <div style={{ padding: '48px', textAlign: 'center' }}>
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

    if (error) {
        return (
            <div style={{ padding: '48px', textAlign: 'center' }}>
                <AlertCircle style={{ width: '48px', height: '48px', color: '#EF4444', margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>Something went wrong</h3>
                <p style={{ color: '#6B7280', marginBottom: '16px' }}>{error}</p>
                <button
                    onClick={fetchProjects}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#000000',
                        color: '#FFFFFF',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '500'
                    }}
                >
                    Try Again
                </button>
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
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>

            {/* Header Section */}
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#000000',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px'
                }}>
                    <FolderOpen style={{ width: '32px', height: '32px', color: '#FFFFFF' }} />
                </div>
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#111827',
                    marginBottom: '12px',
                    margin: '0 0 12px 0'
                }}>
                    Project Management
                </h2>
                <p style={{
                    color: '#6B7280',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    maxWidth: '600px',
                    margin: '0 auto 16px'
                }}>
                    Manage your review analysis projects. Track progress, analyze reviews, and monitor insights.
                </p>
                {projects.some(p => p.status === 'completed' && p.analyzed_reviews < p.total_reviews) && (
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1E40AF',
                        fontWeight: '500'
                    }}>
                        <Info style={{ width: '16px', height: '16px' }} />
                        Some reviews are automatically filtered out (spam, too short, or low-quality content) to improve analysis accuracy
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '24px',
                marginBottom: '32px'
            }}>
                {/* Total Projects */}
                <div style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    padding: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>Total Projects</div>
                        <div style={{
                            padding: '8px',
                            backgroundColor: '#DBEAFE',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FolderOpen style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                        </div>
                    </div>
                    <div style={{ fontSize: '30px', fontWeight: '700', color: '#111827' }}>{projects.length}</div>
                </div>

                {/* In Progress */}
                <div style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    padding: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>In Progress</div>
                        <div style={{
                            padding: '8px',
                            backgroundColor: '#FED7AA',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Clock style={{ width: '20px', height: '20px', color: '#EA580C' }} />
                        </div>
                    </div>
                    <div style={{ fontSize: '30px', fontWeight: '700', color: '#111827' }}>{processingProjects}</div>
                </div>

                {/* Completed */}
                <div style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    padding: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>Completed</div>
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
                    <div style={{ fontSize: '30px', fontWeight: '700', color: '#111827' }}>{completedProjects}</div>
                </div>

                {/* On Hold */}
                <div style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    padding: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>On Hold</div>
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
                    <div style={{ fontSize: '30px', fontWeight: '700', color: '#111827' }}>{errorProjects}</div>
                </div>
            </div>

            {/* Projects Section */}
            <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0' }}>Projects</h2>
                </div>
            </div>

            {/* Search and Filter Controls */}
            <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
                        <Search style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '16px',
                            height: '16px',
                            color: '#9CA3AF'
                        }} />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            style={{
                                width: '100%',
                                paddingLeft: '40px',
                                paddingRight: '16px',
                                paddingTop: '8px',
                                paddingBottom: '8px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '8px',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                            backgroundColor: '#FFFFFF'
                        }}
                    >
                        <option value="all">All Status</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                    </select>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #D1D5DB',
                            backgroundColor: autoRefresh ? '#F0FDF4' : '#FFFFFF',
                            color: autoRefresh ? '#15803D' : '#374151',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}
                        title={autoRefresh ? 'Auto-refresh enabled (tracking progress)' : 'Enable auto-refresh'}
                    >
                        {autoRefresh ? <Pause style={{ width: '16px', height: '16px' }} /> : <Play style={{ width: '16px', height: '16px' }} />}
                        {autoRefresh && projects.some(p => p.status === 'processing') && (
                            <div style={{
                                position: 'absolute',
                                top: '-2px',
                                right: '-2px',
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#10B981',
                                borderRadius: '50%',
                                animation: 'pulse 2s infinite'
                            }}></div>
                        )}
                    </button>
                    <button
                        onClick={fetchProjects}
                        style={{
                            padding: '8px 12px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '8px',
                            backgroundColor: '#FFFFFF',
                            color: '#374151',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <RefreshCw style={{ width: '16px', height: '16px' }} />
                    </button>
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedProjects.size > 0 && (
                <div style={{
                    marginBottom: '24px',
                    padding: '16px',
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <span style={{ fontWeight: '500', color: '#1E40AF' }}>
                            {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <select
                                value={bulkAction}
                                onChange={(e) => setBulkAction(e.target.value)}
                                style={{
                                    padding: '6px 12px',
                                    border: '1px solid #BFDBFE',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    backgroundColor: '#FFFFFF'
                                }}
                            >
                                <option value="">Choose action...</option>
                                <option value="analyze">Standard Analysis</option>
                                <option value="analyze-fast">⚡ Ultra-Fast Analysis</option>
                                <option value="delete">Delete Projects</option>
                            </select>
                            <button
                                onClick={handleBulkAction}
                                disabled={!bulkAction}
                                style={{
                                    padding: '6px 16px',
                                    backgroundColor: '#2563EB',
                                    color: '#FFFFFF',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: bulkAction ? 'pointer' : 'not-allowed',
                                    opacity: bulkAction ? '1' : '0.5'
                                }}
                            >
                                Execute
                            </button>
                            <button
                                onClick={() => setSelectedProjects(new Set())}
                                style={{
                                    padding: '6px 16px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '8px',
                                    backgroundColor: '#FFFFFF',
                                    color: '#374151',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Projects Table */}
            <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <tr>
                            <th style={{ padding: '16px 24px', textAlign: 'left' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedProjects.size === filteredProjects.length && filteredProjects.length > 0}
                                    onChange={toggleSelectAll}
                                    style={{ borderRadius: '4px' }}
                                />
                            </th>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#111827' }}>Project Name</th>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#111827' }}>Status</th>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#111827' }}>Reviews</th>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#111827' }}>Progress</th>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#111827' }}>Created</th>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#111827' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProjects.map((project, index) => {
                            const progress = project.total_reviews > 0 ? Math.round((project.analyzed_reviews / project.total_reviews) * 100) : 0;

                            return (
                                <tr key={project.id} style={{
                                    borderBottom: index < filteredProjects.length - 1 ? '1px solid #E5E7EB' : 'none',
                                    backgroundColor: selectedProjects.has(project.id) ? '#F3F4F6' : 'transparent'
                                }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedProjects.has(project.id)}
                                            onChange={() => toggleProjectSelection(project.id)}
                                            style={{ borderRadius: '4px' }}
                                        />
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ fontWeight: '500', color: '#111827' }}>{project.name}</div>
                                        {project.description && (
                                            <div style={{ fontSize: '14px', color: '#6B7280' }}>{project.description}</div>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            borderRadius: '9999px',
                                            ...getStatusStyling(project)
                                        }}>
                                            {(getDisplayStatus(project) === 'In Progress' || project.status === 'processing') && (
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    backgroundColor: 'currentColor',
                                                    borderRadius: '50%',
                                                    marginRight: '4px',
                                                    animation: 'pulse 2s infinite'
                                                }}></div>
                                            )}
                                            {getDisplayStatus(project)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                                            {project.total_reviews.toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                            {project.analyzed_reviews.toLocaleString()} analyzed
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: '#E5E7EB',
                                                    borderRadius: '9999px',
                                                    height: '8px',
                                                    overflow: 'hidden',
                                                    position: 'relative',
                                                    cursor: project.status === 'completed' && project.analyzed_reviews < project.total_reviews ? 'help' : 'default'
                                                }}
                                                title={
                                                    project.status === 'completed' && project.analyzed_reviews < project.total_reviews
                                                        ? `${project.analyzed_reviews} reviews analyzed, ${project.total_reviews - project.analyzed_reviews} filtered out (spam, too short, etc.)`
                                                        : `${project.analyzed_reviews} of ${project.total_reviews} reviews analyzed`
                                                }
                                            >
                                                <div
                                                    style={{
                                                        backgroundColor: project.status === 'processing' ? '#3B82F6' : '#000000',
                                                        height: '100%',
                                                        borderRadius: '9999px',
                                                        transition: 'width 0.5s ease',
                                                        width: `${progress}%`,
                                                        position: 'relative',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    {project.status === 'processing' && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            right: 0,
                                                            bottom: 0,
                                                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                                            animation: 'shimmer 2s infinite'
                                                        }}></div>
                                                    )}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                color: project.status === 'processing' ? '#3B82F6' : '#111827',
                                                minWidth: '48px'
                                            }}>
                                                {progress}%
                                            </span>
                                        </div>
                                        {project.status === 'processing' && (
                                            <div style={{
                                                fontSize: '12px',
                                                color: '#6B7280',
                                                marginTop: '4px',
                                                fontStyle: 'italic'
                                            }}>
                                                Analyzing reviews...
                                            </div>
                                        )}
                                        {project.status === 'completed' && project.analyzed_reviews < project.total_reviews && (
                                            <div style={{
                                                fontSize: '11px',
                                                color: '#9CA3AF',
                                                marginTop: '2px'
                                            }}>
                                                {project.total_reviews - project.analyzed_reviews} filtered out
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#6B7280' }}>
                                        {new Date(project.created_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {project.total_reviews > 0 && project.analyzed_reviews < project.total_reviews && project.status !== 'processing' && (
                                                <>
                                                    <button
                                                        onClick={() => analyzeProject(project.id, false)}
                                                        disabled={analyzingProject === project.id}
                                                        style={{
                                                            padding: '6px',
                                                            color: '#9CA3AF',
                                                            backgroundColor: 'transparent',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        title="Standard Analysis"
                                                    >
                                                        {analyzingProject === project.id ? (
                                                            <div style={{
                                                                width: '16px',
                                                                height: '16px',
                                                                border: '2px solid #6B7280',
                                                                borderTop: '2px solid transparent',
                                                                borderRadius: '50%',
                                                                animation: 'spin 1s linear infinite'
                                                            }}></div>
                                                        ) : (
                                                            <BarChart3 style={{ width: '16px', height: '16px' }} />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => analyzeProject(project.id, true)}
                                                        disabled={analyzingProject === project.id}
                                                        style={{
                                                            padding: '6px',
                                                            color: '#EAB308',
                                                            backgroundColor: 'transparent',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        title="Ultra-Fast Analysis"
                                                    >
                                                        <Zap style={{ width: '16px', height: '16px' }} />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => deleteProject(project.id, project.name)}
                                                disabled={deletingProject === project.id}
                                                style={{
                                                    padding: '6px',
                                                    color: '#EF4444',
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                title="Delete Project"
                                            >
                                                {deletingProject === project.id ? (
                                                    <div style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        border: '2px solid #EF4444',
                                                        borderTop: '2px solid transparent',
                                                        borderRadius: '50%',
                                                        animation: 'spin 1s linear infinite'
                                                    }}></div>
                                                ) : (
                                                    <Trash2 style={{ width: '16px', height: '16px' }} />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filteredProjects.length === 0 && (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                        <FileText style={{ width: '48px', height: '48px', color: '#9CA3AF', margin: '0 auto 16px' }} />
                        <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', marginBottom: '8px' }}>
                            {globalFilter || statusFilter !== 'all' ? 'No projects found' : 'No projects yet'}
                        </h3>
                        <p style={{ color: '#6B7280', marginBottom: '16px' }}>
                            {globalFilter || statusFilter !== 'all'
                                ? 'Try adjusting your search or filter criteria'
                                : 'Upload some reviews to get started'
                            }
                        </p>
                        {globalFilter || statusFilter !== 'all' ? (
                            <button
                                onClick={() => {
                                    setGlobalFilter('');
                                    setStatusFilter('all');
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#F3F4F6',
                                    color: '#374151',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                Clear Filters
                            </button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
} 