export default function TestPage() {
  return (
    <div>
      <h1>Test Page</h1>
      <p>If you can see this, Next.js routing works!</p>
      <p>Environment test:</p>
      <p>API URL: {process.env.NEXT_PUBLIC_API_URL || 'NOT_SET'}</p>
      <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET'}</p>
    </div>
  );
} 