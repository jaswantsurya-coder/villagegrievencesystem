# Contributing to GramSeva

Thank you for your interest in contributing to GramSeva! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A Supabase account (free tier is sufficient for development)

### Development Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/villagegrievencesystem.git
   cd villagegrievencesystem
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```
5. **Start the development server**:
   ```bash
   npm run dev
   ```

## How to Contribute

### Reporting Bugs

- Use [GitHub Issues](https://github.com/jaswantsurya-coder/villagegrievencesystem/issues) to report bugs
- Include steps to reproduce, expected behavior, and screenshots if applicable
- Check existing issues before creating a new one

### Suggesting Features

- Open a GitHub Issue with the `enhancement` label
- Describe the feature, its use case, and why it benefits GramSeva users

### Submitting Changes

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes with clear, descriptive commits
3. Test your changes locally
4. Push to your fork and open a Pull Request

### Pull Request Guidelines

- **One feature per PR** — Keep PRs focused and reviewable
- **Describe your changes** — Explain what and why, not just how
- **Test locally** — Ensure `npm run build` passes without errors
- **No secrets** — Never commit API keys, passwords, or credentials
- **No SQL files** — Database migrations are managed separately and are gitignored

## Code Style

- **Framework**: React 18 with functional components and hooks
- **Styling**: Tailwind CSS 4
- **Formatting**: Use consistent indentation (2 spaces)
- **Naming**: camelCase for variables/functions, PascalCase for components
- **i18n**: All user-facing strings should use `t('key')` from react-i18next

## Project Structure

```
├── App.jsx              # Main application
├── main.jsx             # Entry point
├── i18n.js              # Translations
├── supabaseClient.js    # Database client
├── components/ui/       # Reusable UI components
└── public/              # Static assets & PWA config
```

## Code of Conduct

- Be respectful and constructive
- Focus on the problem, not the person
- Welcome newcomers and help them learn

---

Thank you for contributing to transparent village governance! 🏘️
