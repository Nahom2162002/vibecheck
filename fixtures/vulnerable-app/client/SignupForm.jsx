// Intentionally vulnerable fixture: client-only validation for vibecheck's
// client-side-validation rule to catch. The matching server handler is
// POST /signup in ../api-forms.js, which has no server-side validation.
import { useState } from 'react';

export default function SignupForm() {
  const [email, setEmail] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    fetch('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        required
        pattern="[^@]+@[^@]+\.[a-zA-Z]{2,}"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Sign up</button>
    </form>
  );
}
