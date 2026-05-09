## Security Gotchas

- Hash passwords with a modern adaptive algorithm — argon2id (preferred), scrypt, or bcrypt (cost ≥12). Plain hashes (MD5/SHA-256) and weak-cost bcrypt are brute-forceable on modern GPUs.
- Rate-limit login: 5 attempts/minute per IP, 20 per account/hour. Password reset: 3/hour per email.
- Error messages must never distinguish "user not found" from "wrong password" — same generic error for both.
- Sanitize output by context: HTML, JS, CSS, URL each need different escaping. `dangerouslySetInnerHTML` with user data is always a critical finding.
- `CORS: *` is never acceptable on authenticated endpoints. Scope origins explicitly.
- Log auth events (login, logout, failed attempts, password changes) but never log passwords, tokens, or full credential request bodies.
- File uploads: validate MIME type server-side (not just extension), limit size, store outside webroot, generate new filenames.
