# GIT Upload Instructions

This project is ready for manual upload to GitHub. Follow these steps locally to avoid committing large or personal files (virtualenvs, editor settings, secrets).

1. Inspect the three special folders

- `.github` — GitHub workflows / templates. Keep if you want CI/workflows stored in the repo.
- `.vscode` — VS Code settings. Keep only if they are intentionally shared project settings.
- `.venv` — Python virtual environment. DO NOT commit this.

2. Add the prepared `.gitignore` (already present in the repo root). Then run:

```bash
# show status
git status

# add .gitignore and any changes
git add .gitignore GIT_UPLOAD_INSTRUCTIONS.md
# optionally add other changes
git add -A

# If you previously committed .venv, untrack it (do this only if .venv exists in repo index):
# (this removes the files from Git tracking but keeps them locally)
if git ls-files --error-unmatch .venv >/dev/null 2>&1; then
  git rm -r --cached .venv
  git commit -m "Remove tracked virtualenv (.venv) and add .gitignore"
else
  git commit -m "Add .gitignore and upload instructions"
fi

# push to your remote (replace branch name if necessary)
git push origin main
# or
# git push origin master
```

3. Verify on GitHub

- Open your repo on GitHub and confirm `.venv` is not present and `.github`/`.vscode` are present only if you wanted them.

Notes & safety

- If you have secrets (files containing API keys, `.env` files), remove them from the repo and rotate keys if they were committed previously.
- If you want me to also remove `.venv` from git tracking here, I can run the `git rm -r --cached .venv` for you (requires permission to run git in your environment).

Questions

- Want me to keep `.vscode` ignored (recommended) or include specific workspace settings in the repo?
- Want me to remove `.venv` from the git index now (I can run the commands if you allow)?
