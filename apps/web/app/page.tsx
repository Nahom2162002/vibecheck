'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        return;
      }
      router.push(`/scans/${data.scanId}`);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <h1>vibecheck</h1>
      <p className="subtitle">Paste a repo URL to scan it for common vibe-coded security flaws.</p>
      <form onSubmit={handleSubmit} className="scan-form">
        <input
          type="text"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Starting…' : 'Scan'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
