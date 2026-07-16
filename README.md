# CodeProof AI

**Measure Understanding. Build Real Skills.**

CodeProof AI is a polished local MVP for demonstrating evidence-based programming assessment at Holberton School. It asks a learner to submit code, explain the actual logic, predict a concrete result, reason about an edge case, and modify the solution. The score prioritizes demonstrated understanding—not whether AI assistance may have been used.

The application uses no API keys, paid APIs, cloud services, account system, or remote model. Student code is analyzed statically and is never executed on the host computer.

## Fastest Windows start

Prerequisites:

- Node.js 22.13 or newer
- Python 3.11 or newer
- A current Chromium-based browser

Double-click `start.bat`, or open this folder in VS Code and run:

```bat
start.bat
```

The script creates a project-local Python environment when needed, installs missing dependencies, verifies the trained model artifact, and starts the app. Open:

```text
http://localhost:3000
```

Keep the terminal open while presenting. Press `Ctrl+C` to stop the server.

## Manual setup in VS Code

Open the integrated terminal in this project directory. On Windows Command Prompt:

```bat
python -m venv --system-site-packages .venv
.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
set npm_config_cache=%CD%\.npm-cache
npm.cmd install
python -m ml.train_model
npm.cmd run dev
```

On PowerShell, activate with:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, activation is optional. Use the environment directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m ml.train_model
npm.cmd run dev
```

## Demo scenarios

The start screen includes one selector and a **Load Demo Scenario** button:

1. **Verified learner** — gradual editing, specific explanation, and strong live verification.
2. **Partial understanding** — mixed paste/edit evidence, basic explanation, and incomplete modification reasoning.
3. **Execution without verification** — instant pastes, generic writing, weak answers, and no successful edit.

All three scenarios go through the same `scoreAssessment` function. Their final scores are calculated at runtime; the demo data does not contain final scores.

For a live presentation, choose a scenario, click **Load Demo Scenario**, then use the normal **Continue to Explanation**, **Generate Verification Questions**, and **Verify Understanding** actions.

## Local ML model

The Python implementation is in `ml/`:

- `features.py` defines the eight transparent style and editor-behavior features.
- `train_model.py` builds a deterministic local training set, fits a standardized scikit-learn logistic regression, reports held-out metrics, and exports the model.
- `predict.py` provides a small command-line prediction utility.
- `app/lib/generated-model.json` is the trained artifact consumed by the web scoring engine.

Train the model again with:

```bat
train-model.bat
```

or:

```bat
.venv\Scripts\python.exe -m ml.train_model
```

The MVP training data is reproducible synthetic evidence data, not a claim about real-world authorship. The model measures similarity to selected behavior/style patterns. Its output is supporting evidence only and never directly decides the Verified Understanding Score. See `MODEL_CARD.md` for the model’s intended use and limitations.

## Run all tests

Double-click `run-tests.bat`, or run:

```bat
npm.cmd test
```

That command runs:

- deterministic scoring and demo tests;
- Python feature, training, artifact, and prediction tests;
- the full production build.

Run individual suites with:

```bat
npm.cmd run test:unit
npm.cmd run test:python
npm.cmd run build
```

## Project structure

```text
app/
  components/CodeEditor.tsx   syntax-aware editor and local activity capture
  lib/analysis.ts             static analysis, question generation, scoring
  lib/demos.ts                three demo evidence profiles
  lib/generated-model.json    trained local logistic model
  lib/history.ts              safe local history/export serialization
  lib/scoring-config.ts       configurable scoring weights
  lib/types.ts                assessment contracts
  globals.css                 responsive product design
  page.tsx                    complete assessment workflow and dashboard
ml/
  features.py                 Python feature engineering
  train_model.py              local training and artifact export
  predict.py                  local CLI inference
tests/
  scoring.test.ts             scoring, demos, history, export, error handling
  test_ml.py                  model and training tests
start.bat                     one-click Windows launcher
train-model.bat               one-click model training
run-tests.bat                 one-click verification
```

## Scoring design

Weights live in `app/lib/scoring-config.ts`. Interactive verification has the largest weight:

- interactive verification: 46%
- explanation quality: 24%
- code understanding: 12%
- behavior authenticity: 11%
- cross-evidence consistency: 7%

Code quality is reported separately and cannot create a high understanding score by itself. Paste behavior can lower supporting authenticity evidence, but strong code-specific explanation and live verification can recover a high result.

## Privacy and security

- Source code, explanations, telemetry, and results stay in browser local storage.
- Only events inside the two application editors are tracked.
- No system-wide keys, clipboard history, files, processes, or commands are captured.
- Submitted code is never executed; analysis is token/structure based.
- React text rendering escapes learner input by default.
- Inputs have length limits and results export as inert JSON.
- There are no command, path, or upload endpoints exposed to learner content.
- Development errors remain in the local terminal; the UI does not render raw stack traces.

Use **History → Clear all local data** to delete saved assessments from the browser.

## Common startup errors

**`npm.ps1 cannot be loaded because running scripts is disabled`**

Use `npm.cmd` exactly as shown in the commands, or run `start.bat`.

**Port 3000 is already in use**

Run the app on another port:

```bat
npm.cmd run dev -- -p 4173
```

Then open `http://localhost:4173`.

**`python` is not recognized**

Install Python 3.11+ and enable **Add Python to PATH**, then restart VS Code.

**Model dependency import fails**

Recreate the local environment:

```bat
rmdir /s /q .venv
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m ml.train_model
```

**The model artifact is missing**

Run `train-model.bat`. A successful run writes `app\lib\generated-model.json`.

**The page does not update after a source edit**

Stop the server with `Ctrl+C`, run `npm.cmd run dev`, and refresh the browser once.

---

**Traditional systems ask: “Did the learner use AI?”**

**CodeProof AI asks: “Can the learner prove that they understand the code?”**
