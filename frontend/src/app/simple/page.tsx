export default function SimplePage() {
    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>Simple Test Page</h1>
            <p>This page works WITHOUT authentication!</p>
            <p>Current time: {new Date().toISOString()}</p>
            <h3>Environment Variables:</h3>
            <ul>
                <li>API URL: {process.env.NEXT_PUBLIC_API_URL || 'NOT_SET'}</li>
                <li>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET'}</li>
            </ul>
        </div>
    );
} 