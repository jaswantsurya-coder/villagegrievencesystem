# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| Latest  | ✅ Active support  |

## Reporting a Vulnerability

If you discover a security vulnerability in GramSeva, **please do not open a public GitHub issue.**

Instead, please report it responsibly by contacting the maintainer:

- **GitHub**: [@jaswantsurya-coder](https://github.com/jaswantsurya-coder)

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix release**: As soon as possible, depending on severity

## Security Measures

This project implements the following security controls:

1. **Row Level Security (RLS)** — Enabled on all application tables in Supabase
2. **Rate Limiting** — Anonymous complaint submissions are rate-limited
3. **Input Validation** — File type, size, and format restrictions on all uploads
4. **Audit Logging** — All administrative actions and state changes are logged
5. **Environment Variables** — All secrets are stored in environment variables, never in source code
6. **Storage Access Control** — Photo evidence access is gated by a `SECURITY DEFINER` function that checks village membership

## Responsible Disclosure

We ask that you:

- Allow reasonable time for us to fix the issue before public disclosure
- Do not access or modify other users' data
- Do not perform actions that could harm the availability of the service

Thank you for helping keep GramSeva and its users safe.
