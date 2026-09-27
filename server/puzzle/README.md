# server/puzzle — a copy, do not edit

These files are copied byte for byte from `src/lib` by `npm run puzzle:sync` (repo root).
Edit the originals in `src/lib`, then sync. `npm run puzzle:check` fails while this copy is behind.
The server uses them to generate puzzle sessions and to check answers; see `puzzleSessions` in
`server/index.js`.
