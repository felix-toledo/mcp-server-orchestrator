module.exports = {
  apps: [
    {
      name: 'voice-assistant',
      script: 'src/main.py',
      // Python 3.13 (this repo's default global interpreter) can't install
      // this service's ML dependencies on Windows — no prebuilt numpy/blis
      // wheel for 3.13, no local C/C++ compiler to build them from source.
      // A dedicated Python 3.11 venv (services/voice-assistant/.venv) is
      // the real interpreter this service runs under — see .env.example's
      // sibling `.venv/` (gitignored) and `package.json`'s `dev:voice-assistant`.
      interpreter: './.venv/Scripts/python.exe',
      cwd: __dirname,
      env: { /* loaded from .env by config.py itself, not duplicated here */ },
    },
  ],
};
