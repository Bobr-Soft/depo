# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please follow these steps:

### Do NOT

- ❌ Open a public GitHub issue
- ❌ Discuss the vulnerability publicly
- ❌ Share details on social media

### Do

1. **Email us directly** at hornyaktibor2@gmail.com

2. **Include the following information**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

3. **Wait for our response** - We aim to respond within 48 hours

### What to Expect

1. **Acknowledgment** - We'll confirm receipt within 48 hours
2. **Investigation** - We'll investigate and keep you updated
3. **Fix** - We'll work on a fix and coordinate disclosure
4. **Credit** - We'll credit you in the security advisory (unless you prefer anonymity)

## Security Best Practices for Contributors

### Environment Variables

- Never commit `.env` files
- Use `.env.example` for documentation
- Store secrets in GitHub Secrets for CI/CD

### Authentication

- Use secure authentication methods
- Never log sensitive data
- Validate all user inputs

### Dependencies

- Keep dependencies updated
- Review Dependabot alerts promptly
- Audit packages before installation

## Security Headers (Web)

Ensure the web app implements:

- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy

## API Security

- All endpoints require authentication (except public ones)
- Input validation on all endpoints
- Rate limiting implemented
- CORS properly configured

Thank you for helping keep Depo secure! 🔒
