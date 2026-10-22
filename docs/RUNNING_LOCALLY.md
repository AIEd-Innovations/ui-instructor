# Running the instructor stack on your machine

Everything runs locally and offline: no cloud account, no model credentials. You start the two agents and the UI, and the UI talks to them directly.

| Piece | Repo | Port | Runs as |
|---|---|---|---|
| Instructor UI (React + Vite) | `ui-instructor` | 5173 | Node |
| Curriculum Designer (FastAPI) | `curriculum-designer` | 8003 | Python, **mock** model, in-memory store |
| Assessment Agent (FastAPI) | `assessment_agent` | 8000 | Python, **fake** model, seeded sample results |

## You need
- Node 20 or newer, Python 3.11 or newer, and git (`node --version`, `python3 --version`).
- The three repos cloned **side by side** in one folder:

```
seniorproject/
  ui-instructor/
  curriculum-designer/
  assessment_agent/
```

## One time
```bash
cd ui-instructor
npm install
npm run dev:setup      # creates a .venv in each agent repo and installs its requirements
```

## Every time
```bash
cd ui-instructor
npm run dev:all
```
It starts both agents, waits until each answers `/health`, hands the UI their addresses, and starts the UI. Open http://localhost:5173 (any login works for now).
Press **Ctrl+C** once and it stops all three. The agents' API docs are at http://localhost:8003/docs and http://localhost:8000/docs.

Options: `npm run dev:all -- --no-assessment` or `-- --no-curriculum` to leave one out.

> The assessment agent needs the changes in `assessment_agent` PR #7 (CORS, the missing `python-multipart`, the offline `fake` model). Until that is merged, check out its branch
> `phase1-local-run`; the script warns you if your checkout does not have it. The Student Submissions tab starts using the agent once the UI's PR #13 is merged; until then it shows sample data.

## Test each agent on its own before you wire it to anything
When something is wrong, you want to know which piece it is. Check an agent with `curl` first; if it works there, the problem is in the wiring.

Curriculum Designer:
```bash
curl localhost:8003/health
curl -X POST localhost:8003/curriculum/generate -H 'content-type: application/json' \
  -d '{"lab_id":"lab4","title":"Linked Lists","learning_objectives":["Implement a list"],"instructor_id":"instructor_1"}'
curl localhost:8003/curriculum/lab4
```
Assessment Agent:
```bash
curl localhost:8000/health
curl 'localhost:8000/results?assignment_id=hw1_sorting'
```
Then check the browser can reach them: open the UI and look at the browser's Network tab. A CORS error means the agent does not list the UI's address in `CORS_ORIGINS`.

## Running the pieces by hand (what the script does)
```bash
# curriculum-designer
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt        # remove the aieic-shared line if the install fails: nothing imports it
LLM_BACKEND=mock STORAGE_BACKEND=memory python -m uvicorn main:app --port 8003

# assessment_agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp demo/seed_results.json assessment_results.json
DEFAULT_LLM_PROVIDER=fake python run.py

# ui-instructor (with the URLs set)
VITE_CURRICULUM_URL=http://localhost:8003 VITE_ASSESSMENT_URL=http://localhost:8000 npm run dev
```

## Settings you may want to change
Anything you already set in your shell wins over the script's defaults.

| Variable | Default in `dev:all` | What it does |
|---|---|---|
| `CURRICULUM_DESIGNER_DIR`, `ASSESSMENT_AGENT_DIR` | `../curriculum-designer`, `../assessment_agent` | where the repos are |
| `CURRICULUM_PYTHON`, `ASSESSMENT_PYTHON` | each repo's `.venv` | which Python to use |
| `CURRICULUM_PORT`, `ASSESSMENT_PORT` | 8003, 8000 | ports |
| `LLM_BACKEND` | `mock` | `azure` uses a real model (needs `AZURE_OPENAI_*`) |
| `STORAGE_BACKEND` | `memory` | `mongo` persists labs (needs `MONGODB_URI`) |
| `DEFAULT_LLM_PROVIDER` | `fake` | `anthropic` (needs `ANTHROPIC_API_KEY`) or `claude_cli` |

## What is real and what is fake in this setup
- The mock Curriculum Designer returns fixed placeholder content and **ignores refinement feedback**: the version number goes up but the quiz does not change. That is the mock, not a bug in the UI.
- The Curriculum Designer's in-memory store forgets everything when it stops.
- The fake assessment model gives canned feedback; scores come from really running the demo submissions against the test cases.
- The seed results include two hand-edited records (one flagged, one needing review) so the table has variety.

## Troubleshooting
- **"Port 8003 is already in use"**: another copy is running. Stop it, or set `CURRICULUM_PORT`.
- **"No Python found for the … service"**: run `npm run dev:setup`, or set `CURRICULUM_PYTHON` / `ASSESSMENT_PYTHON`.
- **pip fails on `aieic-shared`**: it is installed from a git URL and nothing uses it. `dev:setup` leaves it out; by hand, delete that line.
- **Lab Tasks says "VITE_CURRICULUM_URL is not set"**: you started the UI on its own (`npm run dev`) without the variable. Use `npm run dev:all`, or copy `.env.example` to `.env`.
- **The agent died and the whole thing stopped**: by design. The script stops everything if one piece exits, so a failure is obvious. Scroll up for that piece's last lines.

## Docker
The assessment agent's `Dockerfile` has been built and run (non-root, results stored in `/appdata`). See its README. In a container the default `claude_cli` model does not exist; use `anthropic` or `fake`.
