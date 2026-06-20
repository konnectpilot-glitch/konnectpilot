#!/bin/bash
# Run this from Mac Terminal to push latest changes
cd ~/Desktop/konnectpilot
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "${1:-update}"
git push
