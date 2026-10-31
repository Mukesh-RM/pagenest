#!/bin/sh
# Regenerates the audio files used by audio-playback.spec.ts. They are synthetic sine tones (no third-party audio),
# so they carry no license. Needs ffmpeg. The files are committed so the test does not need ffmpeg.
set -e
cd "$(dirname "$0")"
cat > /tmp/pn-chapters.txt <<'META'
;FFMETADATA1
title=Chaptered Tale
artist=Test Author
album=Chaptered Tale
composer=Test Narrator
[CHAPTER]
TIMEBASE=1/1000
START=0
END=8000
title=Opening tones
[CHAPTER]
TIMEBASE=1/1000
START=8000
END=20000
title=Second movement
META
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=330:duration=20" -i /tmp/pn-chapters.txt -map 0:a -map_metadata 1 -map_chapters 1 -ac 1 -c:a aac -b:a 32k -f ipod chaptered-tale.m4b
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=20" -ac 1 -c:a libmp3lame -b:a 32k \
  -metadata title="Tone Book" -metadata album="Tone Book" -metadata artist="Test Author" tone-book.mp3
