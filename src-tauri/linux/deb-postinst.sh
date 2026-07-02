#!/bin/sh
set -e

# Optional opt-out: EZDOWN_SKIP_DEFAULT_MIME=1 dpkg -i ezdown.deb
if [ "$1" = "configure" ] && [ -z "$EZDOWN_SKIP_DEFAULT_MIME" ]; then
  if command -v xdg-mime >/dev/null 2>&1; then
    for desktop in /usr/share/applications/ezdown.desktop /usr/share/applications/dev.ezdown.app.desktop; do
      if [ -f "$desktop" ]; then
        xdg-mime default "$(basename "$desktop")" text/markdown 2>/dev/null || true
        xdg-mime default "$(basename "$desktop")" text/x-markdown 2>/dev/null || true
        break
      fi
    done
  fi
fi

exit 0
