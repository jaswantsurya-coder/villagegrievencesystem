# Catching bugs and future errors with Sentry — GramSeva

Nothing Sentry-related exists in the repo today. You have **four separate runtimes**, and each needs its own SDK + DSN project. Use one Sentry organisation with four projects so issues stay attributable:

| Project | Runtime | Files |
|---|---|---|
| `gramseva-web` | React 18 + Vite SPA | `main.jsx`, `App.jsx` |
| `gramseva-api` | Vercel Node serverless | `api/*.js` |
| `gramseva-py` | Vercel Python FastAPI | `api/py/*.py` |
| `gramseva-ai` | Oracle VM FastAPI + worker | `oracle-inference/*.py` |

## See implementation details in the sections below.
## Implementation status: IN PROGRESS
