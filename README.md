# Pose Information Extraction

Local, buildless portfolio page using the Golf Swing 3D Reconstruction template. It retains the typography, responsive left navigation, six sections (Abstract, Introduction, Method, Results, Discussion, Conclusion), and 3D snapshot carousel. Section copy is an initial scaffold for this project.

## Run

Requires Node.js 22+ and ffmpeg/ffprobe on PATH.

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:8008. The first run prepares browser-compatible H.264 video previews and exact frame timestamps; later runs reuse them. No npm installation is needed.

## Materials

- `materials/content.json`: page metadata and section copy; optional metric cards are already supported by the renderer.
- `materials/data/3d_results/<id>.json`: reconstruction frames, exported `joints` list, and estimated camera calibration, preserving the supplied flat folder structure.
- `materials/data/videos/<id>/{face-on,down-the-line}.mp4`: original recordings.
- `materials/data/videos/<id>/sync.json`: shared timeline mappings to raw frame indices for both recordings.
- `materials/data/snapshot.json`: highlight duration, hold time, and trail joints. An omitted range uses the complete reconstruction.
- `materials/data/credits.json`: source links keyed by swing ID.
- `materials/data/metrics/`: reserved for later UI integration; unchanged and unused by the current viewer.
- `materials/data/videos.json`: generated video catalog.
- `materials/data/previews/`: ignored generated H.264 videos and frame timestamp sidecars.

The player renders 3D reconstruction with calibrated video planes, without 2D detection overlays. Each reconstruction frame corresponds to one sync timeline step. Playback, scrubbing, and frame stepping use `sync.mapping[view][step]` to select source frames, preserving repeated/skipped frames. Mismatched timeline lengths disable that swing and display a diagnostic rather than guessing an alignment.

## Checks and static build

```sh
node --test tests/*.test.mjs
node scripts/build-site.mjs
node scripts/serve.mjs --dist
```

The build generates a standalone `dist/` with only the required presentation assets. Metrics remain in the source materials until their UI is implemented.

## Git workflow

Work on a feature branch, run checks and the static build, then commit source and materials. Generated previews and `dist/` are ignored. The included GitHub Actions workflow tests and builds on pushes to `main`/`master` and deploys the static artifact to GitHub Pages. In repository Settings → Pages, select **GitHub Actions** as the source. Manual deployment is also available with `workflow_dispatch`.

Bone connections in `pose-structure.js` follow Ideaslab `IL_H36M_POSE + GOLFCLUB`, resolved against each file’s joint names. Floor placement, body centering, joint markers, and trails also use these names.
