#!/bin/bash
for i in $(seq 1 10); do
  remaining=$(ls /home/z/my-project/public/TDC-Intro/assets/ 2>/dev/null | wc -l)
  if [ "$remaining" -ge 6 ]; then echo "ALL DONE"; break; fi
  echo "=== iteration $i (have $remaining/6) ==="
  bun run scripts/gen-tdc-images.mjs >> /home/z/my-project/scripts/gen-images.log 2>&1
  sleep 3
done
echo "LOOP FINISHED"
ls -la /home/z/my-project/public/TDC-Intro/assets/
