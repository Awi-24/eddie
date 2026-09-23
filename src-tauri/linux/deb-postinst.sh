#!/bin/sh
set -e

# Optional opt-out: EDDIE_SKIP_DEFAULT_MIME=1 dpkg -i eddie.deb
# (EZDOWN_SKIP_DEFAULT_MIME from the ez.down days is still honored.)
if [ "$1" = "configure" ] && [ -z "$EDDIE_SKIP_DEFAULT_MIME" ] && [ -z "$EZDOWN_SKIP_DEFAULT_MIME" ]; then
  if command -v xdg-mime >/dev/null 2>&1; then
    for desktop in /usr/share/applications/Eddie.desktop /usr/share/applications/eddie.desktop /usr/share/applications/dev.ezdown.app.desktop; do
      if [ -f "$desktop" ]; then
        xdg-mime default "$(basename "$desktop")" text/markdown 2>/dev/null || true
        xdg-mime default "$(basename "$desktop")" text/x-markdown 2>/dev/null || true
        break
      fi
    done
  fi
fi

exit 0
