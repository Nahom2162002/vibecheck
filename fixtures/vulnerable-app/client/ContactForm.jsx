// Fixture: client-side validation backed by matching server-side validation
// (POST /contact in ../api-forms.js) — should NOT be flagged.
import { useState } from 'react';

export default function ContactForm() {
  const [email, setEmail] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    fetch('/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit">Send</button>
    </form>
  );
}
