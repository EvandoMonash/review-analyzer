'use client';

import React, { useState } from 'react';
import { Upload, FileText, Link2, Sparkles, CheckCircle, AlertCircle, Info, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UploadSectionProps {
    onProjectCreated?: () => void;
}

export default function UploadSection({ onProjectCreated }: UploadSectionProps) {
    const { session } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState('');
    const [projectName, setProjectName] = useState('');
    const [description, setDescription] = useState('');
    const [maxReviews, setMaxReviews] = useState(1000);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleSubmit = async () => {
        if (!projectName) {
            alert('Please enter a project name');
            return;
        }

        if (!file && !url) {
            alert('Please either upload a CSV file or enter a Google Reviews URL');
            return;
        }

        setIsUploading(true);
        setUploadResult(null);

        try {
            if (url) {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/projects`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({
                        name: projectName,
                        description,
                        googleUrl: url,
                        maxReviews: maxReviews
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    setUploadResult({
                        success: true,
                        message: `✅ Project "${projectName}" created successfully!`,
                        reviewCount: data.reviewCount || 0,
                        projectId: data.projectId
                    });
                    // Clear form on success
                    setUrl('');
                    setProjectName('');
                    setDescription('');
                    setMaxReviews(1000);
                } else {
                    setUploadResult({
                        success: false,
                        message: `❌ Failed to create project: ${data.error || 'Unknown error'}`
                    });
                }
            } else if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('projectName', projectName);
                formData.append('description', description);

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: formData,
                });

                const data = await response.json();

                if (data.success) {
                    setUploadResult({
                        success: true,
                        message: `✅ Project "${projectName}" created successfully!`,
                        reviewCount: data.reviewCount || 0,
                        projectId: data.projectId
                    });
                    // Clear form on success
                    setFile(null);
                    setProjectName('');
                    setDescription('');
                } else {
                    setUploadResult({
                        success: false,
                        message: `❌ Failed to upload file: ${data.error || 'Unknown error'}`
                    });
                }
            }
        } catch (error) {
            setUploadResult({
                success: false,
                message: '❌ Network error. Please try again.'
            });
        } finally {
            setIsUploading(false);
        }
    };

    const resetForm = () => {
        setFile(null);
        setUrl('');
        setProjectName('');
        setDescription('');
        setUploadResult(null);
    };

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
                    <Upload style={{ width: '32px', height: '32px', color: '#FFFFFF' }} />
                </div>
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#111827',
                    marginBottom: '12px',
                    margin: '0 0 12px 0'
                }}>
                    Create New Project
                </h2>
                <p style={{
                    color: '#6B7280',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    maxWidth: '600px',
                    margin: '0 auto'
                }}>
                    Start a new review analysis project. Upload a CSV file with reviews or connect your Google My Business to begin analyzing customer feedback.
                </p>
            </div>

            {!uploadResult ? (
                <>
                    {/* Project Information Card */}
                    <div style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E5E7EB',
                        padding: '24px',
                        marginBottom: '24px'
                    }}>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '16px',
                            margin: '0 0 16px 0'
                        }}>
                            Project Information
                        </h3>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                Project Name *
                            </label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="Enter a descriptive name for your project"
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                Description (Optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add a description for your project"
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    outline: 'none',
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                marginBottom: '8px'
                            }}>
                                Maximum Reviews to Scrape
                            </label>
                            <select
                                value={maxReviews}
                                onChange={(e) => setMaxReviews(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    outline: 'none',
                                    backgroundColor: '#FFFFFF',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value={100}>100 reviews (fast)</option>
                                <option value={200}>200 reviews (recommended)</option>
                                <option value={500}>500 reviews</option>
                                <option value={1000}>1000 reviews (comprehensive)</option>
                                <option value={1500}>1500 reviews (maximum)</option>
                            </select>
                            <div style={{
                                fontSize: '12px',
                                color: '#6B7280',
                                marginTop: '4px',
                                lineHeight: '1.4'
                            }}>
                                💰 With your paid plan, you can request more reviews. Note: Google Maps may still paginate results internally.
                            </div>
                        </div>
                    </div>

                    {/* Upload Options */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '24px',
                        marginBottom: '32px'
                    }}>
                        {/* CSV Upload Option */}
                        <div style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB',
                            padding: '24px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                                <div style={{
                                    padding: '8px',
                                    backgroundColor: '#DBEAFE',
                                    borderRadius: '8px',
                                    marginRight: '12px'
                                }}>
                                    <FileText style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                                </div>
                                <h3 style={{
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: '#111827',
                                    margin: '0'
                                }}>
                                    Upload CSV File
                                </h3>
                            </div>

                            <p style={{
                                color: '#6B7280',
                                fontSize: '14px',
                                marginBottom: '16px',
                                lineHeight: '1.5'
                            }}>
                                Upload a CSV file containing customer reviews. The file should have columns for review text, ratings, and other relevant data.
                            </p>

                            <div style={{
                                border: '2px dashed #D1D5DB',
                                borderRadius: '8px',
                                padding: '24px',
                                textAlign: 'center',
                                marginBottom: '16px',
                                backgroundColor: file ? '#F0FDF4' : '#F9FAFB',
                                borderColor: file ? '#16A34A' : '#D1D5DB'
                            }}>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                    id="csv-upload"
                                />
                                <label
                                    htmlFor="csv-upload"
                                    style={{
                                        cursor: 'pointer',
                                        display: 'block'
                                    }}
                                >
                                    {file ? (
                                        <>
                                            <CheckCircle style={{
                                                width: '48px',
                                                height: '48px',
                                                color: '#16A34A',
                                                margin: '0 auto 16px'
                                            }} />
                                            <div style={{
                                                fontSize: '16px',
                                                fontWeight: '500',
                                                color: '#111827',
                                                marginBottom: '8px'
                                            }}>
                                                {file.name}
                                            </div>
                                            <div style={{
                                                fontSize: '14px',
                                                color: '#6B7280'
                                            }}>
                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Upload style={{
                                                width: '48px',
                                                height: '48px',
                                                color: '#9CA3AF',
                                                margin: '0 auto 16px'
                                            }} />
                                            <div style={{
                                                fontSize: '16px',
                                                fontWeight: '500',
                                                color: '#111827',
                                                marginBottom: '8px'
                                            }}>
                                                Choose CSV file
                                            </div>
                                            <div style={{
                                                fontSize: '14px',
                                                color: '#6B7280'
                                            }}>
                                                or drag and drop here
                                            </div>
                                        </>
                                    )}
                                </label>
                            </div>

                            {file && (
                                <button
                                    onClick={() => setFile(null)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 16px',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: '8px',
                                        backgroundColor: '#FFFFFF',
                                        color: '#374151',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        fontWeight: '500'
                                    }}
                                >
                                    Remove File
                                </button>
                            )}
                        </div>

                        {/* Google Reviews URL Option */}
                        <div style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB',
                            padding: '24px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                                <div style={{
                                    padding: '8px',
                                    backgroundColor: '#FED7AA',
                                    borderRadius: '8px',
                                    marginRight: '12px'
                                }}>
                                    <Link2 style={{ width: '20px', height: '20px', color: '#EA580C' }} />
                                </div>
                                <h3 style={{
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: '#111827',
                                    margin: '0'
                                }}>
                                    Google Reviews URL
                                </h3>
                            </div>

                            <p style={{
                                color: '#6B7280',
                                fontSize: '14px',
                                marginBottom: '16px',
                                lineHeight: '1.5'
                            }}>
                                Enter your Google My Business URL or a Google Maps place URL to automatically scrape and analyze reviews.
                            </p>

                            {/* URL Format Help */}
                            <div style={{
                                backgroundColor: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '16px'
                            }}>
                                <div style={{
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#1E40AF',
                                    marginBottom: '8px'
                                }}>
                                    📋 URL Format Requirements:
                                </div>
                                <div style={{
                                    fontSize: '13px',
                                    color: '#374151',
                                    lineHeight: '1.4'
                                }}>
                                    <div style={{ marginBottom: '6px' }}>
                                        <strong>✅ Use full URLs like:</strong><br />
                                        <code style={{
                                            backgroundColor: '#F3F4F6',
                                            padding: '2px 4px',
                                            borderRadius: '4px',
                                            fontSize: '12px'
                                        }}>
                                            https://www.google.com/maps/place/Business+Name/@40.7128,-74.0060...
                                        </code>
                                    </div>
                                    <div style={{ marginBottom: '6px' }}>
                                        <strong>❌ Don't use shortened links like:</strong><br />
                                        <code style={{
                                            backgroundColor: '#FEF2F2',
                                            padding: '2px 4px',
                                            borderRadius: '4px',
                                            fontSize: '12px'
                                        }}>
                                            https://maps.app.goo.gl/...
                                        </code>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>
                                        💡 <strong>How to get the right URL:</strong> Search for your business on Google Maps, click on it, then copy the full URL from your browser's address bar.
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://maps.google.com/..."
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{
                                backgroundColor: '#FEF3C7',
                                border: '1px solid #F59E0B',
                                borderRadius: '8px',
                                padding: '12px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px'
                            }}>
                                <Info style={{ width: '16px', height: '16px', color: '#D97706', marginTop: '2px' }} />
                                <div style={{ fontSize: '12px', color: '#92400E', lineHeight: '1.4' }}>
                                    <strong>Note:</strong> Make sure the URL is publicly accessible and contains customer reviews.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '12px',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={resetForm}
                            style={{
                                padding: '12px 24px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '8px',
                                backgroundColor: '#FFFFFF',
                                color: '#374151',
                                fontSize: '16px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Reset Form
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isUploading || !projectName || (!file && !url)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 24px',
                                backgroundColor: isUploading || !projectName || (!file && !url) ? '#9CA3AF' : '#000000',
                                color: '#FFFFFF',
                                borderRadius: '8px',
                                border: 'none',
                                fontSize: '16px',
                                fontWeight: '500',
                                cursor: isUploading || !projectName || (!file && !url) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isUploading ? (
                                <>
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        border: '2px solid #FFFFFF',
                                        borderTop: '2px solid transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }}></div>
                                    Creating Project...
                                </>
                            ) : (
                                <>
                                    <Sparkles style={{ width: '20px', height: '20px' }} />
                                    Create Project
                                </>
                            )}
                        </button>
                    </div>
                </>
            ) : (
                /* Success/Error Result */
                <div style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    padding: '48px',
                    textAlign: 'center'
                }}>
                    {uploadResult.success ? (
                        <>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                backgroundColor: '#16A34A',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 24px'
                            }}>
                                <CheckCircle style={{ width: '32px', height: '32px', color: '#FFFFFF' }} />
                            </div>
                            <h3 style={{
                                fontSize: '24px',
                                fontWeight: '700',
                                color: '#111827',
                                marginBottom: '12px',
                                margin: '0 0 12px 0'
                            }}>
                                Project Created Successfully!
                            </h3>
                            <p style={{
                                color: '#6B7280',
                                fontSize: '16px',
                                marginBottom: '24px',
                                lineHeight: '1.5'
                            }}>
                                {uploadResult.message}
                            </p>
                            {uploadResult.reviewCount > 0 && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                    gap: '16px',
                                    marginBottom: '32px',
                                    maxWidth: '400px',
                                    margin: '0 auto 32px'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#2563EB' }}>
                                            {uploadResult.reviewCount}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6B7280' }}>Reviews Found</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#16A34A' }}>Ready</div>
                                        <div style={{ fontSize: '12px', color: '#6B7280' }}>For Analysis</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#7C3AED' }}>AI</div>
                                        <div style={{ fontSize: '12px', color: '#6B7280' }}>Powered</div>
                                    </div>
                                </div>
                            )}
                            <p style={{
                                color: '#374151',
                                fontSize: '16px',
                                fontWeight: '500',
                                marginBottom: '24px'
                            }}>
                                🎉 Head to the Projects tab to start analyzing your reviews!
                            </p>
                        </>
                    ) : (
                        <>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                backgroundColor: '#EF4444',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 24px'
                            }}>
                                <AlertCircle style={{ width: '32px', height: '32px', color: '#FFFFFF' }} />
                            </div>
                            <h3 style={{
                                fontSize: '24px',
                                fontWeight: '700',
                                color: '#111827',
                                marginBottom: '12px',
                                margin: '0 0 12px 0'
                            }}>
                                Upload Failed
                            </h3>
                            <p style={{
                                color: '#6B7280',
                                fontSize: '16px',
                                marginBottom: '24px',
                                lineHeight: '1.5'
                            }}>
                                {uploadResult.message}
                            </p>
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                        <button
                            onClick={resetForm}
                            style={{
                                padding: '12px 24px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '8px',
                                backgroundColor: '#FFFFFF',
                                color: '#374151',
                                fontSize: '16px',
                                fontWeight: '500',
                                cursor: 'pointer'
                            }}
                        >
                            Create Another Project
                        </button>
                        {uploadResult.success && (
                            <button
                                onClick={() => {
                                    setUploadResult(null); // Clear the success message
                                    if (onProjectCreated) {
                                        onProjectCreated();
                                    }
                                }}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: '#000000',
                                    color: '#FFFFFF',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontSize: '16px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                            >
                                View Projects
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
} 