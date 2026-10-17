# AI Ed Innovations: Instructor UI

React + Vite + TypeScript dashboard for instructors. The Lab Tasks and Lab Quiz tabs call the **Curriculum Designer** agent directly
(there is no orchestrator in between). The other tabs still show sample data.

| Tab | Backed by |
|---|---|
| Lab Tasks, Lab Quiz | Curriculum Designer (`curriculum-designer` repo, port 8003) |
| Student Submissions, Statistics | sample data for now |

The Student Activity and AI Overview tabs are commented out in `src/App.tsx` (kept, not deleted). `src/api/agents.ts` is legacy code for an
orchestrator that was never built; nothing uses it.

## Run it

```bash
npm install
cp .env.example .env     # adjust the URL if your agent runs elsewhere
npm run dev              # http://localhost:5173 (any login works for now)
```

Start the Curriculum Designer it talks to (see that repo's README for details):

```bash
cd ../curriculum-designer
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt     # if the aieic-shared git line fails to install, remove it: nothing imports it
LLM_BACKEND=mock STORAGE_BACKEND=memory python -m uvicorn main:app --port 8003
```

- `LLM_BACKEND=mock` needs no model credentials. In mock mode generation returns fixed placeholder content and **ignores refinement feedback**
  (the version bumps, the quiz does not change).
- `STORAGE_BACKEND=memory` loses all labs on restart. Use `mongo` with `MONGODB_URI` to persist them.

## Configuration

Vite only exposes variables that start with `VITE_`, and they end up in the browser bundle, so never put a secret in them. See `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_CURRICULUM_URL` | none (the UI shows a "not configured" banner) | where the Curriculum Designer is running |
| `VITE_LAB_ID` | `lab4` | which lab the dashboard shows |
| `VITE_COURSE_ID`, `VITE_INSTRUCTOR_ID` | `csc580`, `instructor_1` | sent to the agent when generating and approving |

## How it is put together

- `src/api/curriculum.ts`: the typed client. Errors from the agent become `AgentError` with a readable message and a `code`
  (`LAB_NOT_FOUND`, `UNREACHABLE`, `TIMEOUT`, `NOT_CONFIGURED`, ...). Requests give up after 150 s.
- `src/state/`: `LabProvider` holds the one copy of the lab and its uploaded files; the tabs, sidebar and dialogs all read and update it through `useLab()`.
- `src/tabs/`: one file per tab. `src/components/`: dialogs and small shared pieces.
- Styling is plain CSS in `src/index.css`. Look and feel is deliberately minimal for now.

## Checks

```bash
npx tsc -b && npx eslint src && npm run build
```
There is no test runner on `main` yet. `npm run build` writes `dist/`, which is gitignored.

## Deploying

Vercel deploys `main`. Vite bakes `VITE_*` values in at **build time**, so set them in the Vercel project's environment variables
(Production) and redeploy. Until a Curriculum Designer is deployed and `VITE_CURRICULUM_URL` is set, the live Lab tabs show the "not configured" state.

## Contributing

Branch from `main`, open a pull request, and get one approval from a code owner (see `CODEOWNERS`); an author cannot approve their own PR.
Comment out (do not delete) features that are being deactivated.
