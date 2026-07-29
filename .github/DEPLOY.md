# Self-hosted runner setup for production deploys (LAN NUC)
#
# GitHub-hosted Actions cannot reach 192.168.0.110. Install a runner on the
# NUC so the Deploy workflow can `git pull` + `docker compose up`.
#
# On the NUC (once):
#
# 1. Create a fine-grained or classic PAT / use repo Settings → Actions → Runners
#    → New self-hosted runner. Copy the config token from the UI.
#
# 2. As user `nikhil` (same user that owns ~/apps/ourtable and the docker group):
#
#      mkdir -p ~/actions-runner && cd ~/actions-runner
#      curl -o actions-runner-linux-x64.tar.gz -L \
#        https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
#      # use the version shown in the GitHub "New self-hosted runner" page
#      tar xzf ./actions-runner-linux-x64-*.tar.gz
#      ./config.sh --url https://github.com/itsnikhil/ourtable \
#        --token <TOKEN_FROM_GITHUB_UI> \
#        --labels ourtable,production \
#        --name nuc-ourtable
#      sudo ./svc.sh install
#      sudo ./svc.sh start
#
# 3. Confirm the runner is Idle under Settings → Actions → Runners.
#
# 4. Ensure the app checkout exists and docker works without sudo:
#
#      cd ~/apps/ourtable && git status
#      docker compose -f docker-compose.prod.yml ps
#
# Optional: set repository variable OURTABLE_APP_DIR if the clone is not
# /home/nikhil/apps/ourtable.
#
# After that, every push to main triggers Deploy automatically.
