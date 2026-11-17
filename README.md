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

The course, the lab, the instructor and the assignment used to be settings
(`VITE_COURSE_ID`, `VITE_LAB_ID`, `VITE_INSTRUCTOR_ID`, `VITE_ASSIGNMENT_ID`),
which meant every teacher saw the same lab. They are gone: see **Your courses
and labs** below.

## Your courses and labs

After sign-in the dashboard asks the Curriculum Designer `GET /me` — who is
signed in, and which courses they own.

- **No courses yet:** a "Create your first course" form (`POST /courses`, a
  name is all it takes). Labs live in a course, and a course has one owner.
- **One or more:** a course picker in the header, with **+ New course…**, and
  beside it a lab picker for that course (`GET /courses/{id}/labs`) with
  **+ New lab…**. A new lab gets its own id from its title, and the Generate
  dialog creates it.

Every request carries the chosen course, so the agents can tell whose lab it
is: `401` means the sign-in expired (the dashboard returns to the sign-in page
and says so), `403` means the course belongs to another instructor. An
assignment's id is its lab's id, so the Student Submissions tab follows the
same picker. Nothing is remembered between reloads: `GET /me` runs again and
the first course and its newest lab open.

PDF exports are downloaded with `fetch` and the ID token rather than a plain
link, because a link cannot carry a token.

## Signing in

With `VITE_MS_CLIENT_ID` set, the login page is **Sign in with Microsoft**, restricted to `@calpoly.edu` accounts (MSAL). The redirect flow (default) keeps the sign-in in this tab's sessionStorage, so a reload stays signed in; `VITE_MS_LOGIN_FLOW=popup` uses a popup and keeps it in memory only. Without a client ID, a development form accepts anything and says so. After signing in, the API key dialog opens; **Sign out** also clears the key.

To enable it, register an app in Microsoft Entra ID (platform **Single-page application**, redirect URI = the UI's origin + `/redirect.html`) and set `VITE_MS_CLIENT_ID` and `VITE_MS_TENANT_ID` (also in the Vercel project). Step-by-step setup, testing and what each error code means: [docs/MICROSOFT_SIGN_IN.md](docs/MICROSOFT_SIGN_IN.md).

The `@calpoly.edu` check in the page is a convenience, not security: anyone can edit client-side code. Real enforcement is the tenant restriction above plus each service verifying the ID token, which they do not do yet.

## Instructor API key

The instructor uses their own model account: **Add API key** (top right) takes a model and a key. The key is held in memory only, never in `localStorage`, `sessionStorage`, cookies or the URL, so reloading the tab forgets it. It is sent as `X-LLM-API-Key` (plus `X-LLM-Model` for the Curriculum Designer) only on requests that call a model: generate, request changes, check typos and regrade. The Assessment Agent grades with the model set on the assignment, so the key has to be for that vendor. Code: `src/api/llmKey.ts`.

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
