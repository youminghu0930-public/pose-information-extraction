# Pose Information Extraction

Local, buildless portfolio page using the Golf Swing 3D Reconstruction template. It retains the typography, responsive left navigation, six sections (Abstract, Introduction, Method, Results, Discussion, Conclusion), and 3D metric snapshots with a left-side navigator. Section copy is an initial scaffold for this project.

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
- `materials/data/snapshot.json`: metric demos in the nested format `{type_name: {subtype_name: {video: video_name, frame: frame_index, duration: seconds, stay: seconds}}}`. Each frame index is a zero-based reconstruction index; the reference comes from the matching metrics file’s `meta.ref_frame_id`.
- `materials/data/credits.json`: source links keyed by swing ID.
- `materials/data/metrics/`: metric exports; snapshot comparisons use `meta.ref_frame_id` and validate the selected type/subtype. The modular explanation library visualizes each selected measurement.
- `materials/data/videos.json`: generated video catalog.
- `materials/data/previews/`: ignored generated H.264 videos and frame timestamp sidecars.

The player renders 3D reconstruction with calibrated video planes, without 2D detection overlays. Each reconstruction frame corresponds to one sync timeline step. Playback, scrubbing, and frame stepping use `sync.mapping[view][step]` to select source frames, preserving repeated/skipped frames. Mismatched timeline lengths disable that swing and display a diagnostic rather than guessing an alignment.

## Checks and static build

```sh
node --test tests/*.test.mjs
node scripts/build-site.mjs
node scripts/serve.mjs --dist
```

The build generates a standalone `dist/` with only the required presentation assets. Metrics files are included for static snapshot comparisons.

## Git workflow

Work on a feature branch, run checks and the static build, then commit source and materials. Generated previews and `dist/` are ignored. The included GitHub Actions workflow tests and builds on pushes to `main`/`master` and deploys the static artifact to GitHub Pages. In repository Settings → Pages, select **GitHub Actions** as the source. Manual deployment is also available with `workflow_dispatch`.

Bone connections in `pose-structure.js` follow Ideaslab `IL_H36M_POSE + GOLFCLUB`, resolved against each file’s joint names. Floor placement, body centering, joint markers, and trails also use these names.

## Visual explanation library

`explain/` mirrors the calculation code while keeping domain logic separate from UI:

- `names.js`: shared display names for types, subtypes, components, joints and axes. Raw metric keys are unchanged.
- `math.js`: vector projection, signed rotation, inclination and the Y–X–Z torso rotation decomposition.
- `context.js`: exported alignment metadata, joint lookup and shared shoulder/hip/spine feature extraction. Helpers convert between the normalized metric frame and original source coordinates.
- `visuals.js`: reusable recipes for directions, measurement planes, projected vectors and angle arcs.
- `metrics/kinematic.js`: torso rotation and hip/shoulder rotation around the lower spine.
- `metrics/geometric.js`: shoulder/hip direction, spine lean, and spine direction/twist.
- `metrics/position.js`: normalized hip displacement and its three components.
- `index.js`: registry, value selection, recomputation and export agreement checks.
- `ui/scene.js`: Three.js geometry/label rendering and cleanup, independent of the metric subtype.
- `choreography/construction.js`: reusable joint-pair axis construction stages, holds, and camera pauses; accepts a frame definition and display label.
- `choreography/intrinsic-rotation.js`: Y–X–Z frame rotation, camera alignment, axis highlighting, angle sectors, and reset sampling.
- `choreography/torso.js`: composes the reference and torso construction with the shared rotation sequence; no DOM or rendering dependencies.
- `ui/snapshot.js`: presentation registry and viewer adapter. The pose viewer mounts one explanation and forwards camera updates without branching on metric subtype.
- `ui/playback.js`: shared visibility-aware clock, pause/resume, reduced-motion initialization, and lifecycle cleanup for both players.
- `ui/dom.js`: shared DOM and accessible play-button helpers.
- `ui/timeline.js`: reusable animation phases and sequences.
- `ui/panel.js`: shared component selectors, automatic playback, pause/replay and results.
- `ui/labels.js`: readable callouts that follow the animated geometry.

Snapshots choose their recipe with `type` and `subtype`. Watch directions form, vectors project onto planes, and signed angle arcs sweep to their results on the static reference/selected pose comparison. Playback automatically moves through the components, sharing common construction steps. Select a component to replay it alone, or use pause/replay. Animations stop advancing offscreen and when the tab is hidden; reduced-motion preferences start with a static result. Angle explanations show reference-based global orientation where used, without scale or translation steps. Position explanations identify the fixed reference-ankle midpoint origin, normalization, and reference-hip displacement.

All eight exported subtypes are supported (seven angular and one position subtype). To add another subtype, add a recipe to the matching metric family and labels to `names.js`; return named values and component step lists containing the shared visual primitives. No changes to the panel or 3D renderer are needed. Build validation rejects a selected snapshot whose recomputed result disagrees with its exported metric. Tests compare all components at every frame in every supplied swing, including signed angles and inverse alignment.

### Torso coordinate-frame animation

The torso example uses `choreography/axis-frame.js` for both coordinate-frame constructions. Reference inputs are reference-frame ankles and global up `[0,-1,0]`; torso inputs are selected-frame shoulders and the upper-spine direction, with the same fallback order as the Python code. Positive left is right joint → left joint, matching the saved orientation.

`choreography/torso.js` provides a deterministic, seekable sequence: both skeletons → reference-only → grow/shrink lateral arrow → up arrow → fixed-head orthogonalization → growing red plane → forward arrow → current-only → repeat construction for torso → fade → align reference origin and length → intrinsic Y/X/Z rotations → coincident frames. Violet/cyan/magenta encode X/Y/Z throughout. The target axes use wider translucent lines, leaving the solid reference axes visible inside at completion. Values animate only in their respective rotation steps.

`ui/axis-frame.js` renders both frames using the same flat-arrow/plane primitives; `ui/torso-player.js` connects playback, pose fades, scrubber and live values. Tests verify the reference frame against `meta.orientation`, constant-length orthogonalization, fade stages, and final axis coincidence across all swings.

Axis-construction vocabulary follows the requested convention: **head** is the starting/anchored end and **tail** is the arrow-tip end. Shrinking moves the head from the right joint to the midpoint while the tail stays at the left joint. Orthogonalization rotates the tail around the fixed midpoint head, preserving length. All completed axes extend outward from their common origin.

The latest torso presentation uses flat projected arrows (2px reference, 4.5px translucent target), a dedicated violet/cyan/magenta axis palette in `explain/palette.js`, transparent poses during construction, and short holds between actions. Construction planes remain full-size while the forward arrow grows and then fade by opacity. Camera-only stages align the optical axis with each upcoming rotation axis and settle before the value starts moving. A same-color transparent sector grows with each signed angle. Values are stacked at the right; snapshot titles and frame-index labels are omitted.

Snapshot previews reserve their loading window immediately, before importing the 3D module, and retain card placeholders until the first layout-sized render. Component removal shows the left/up angle as a pie sector, viewed face-on; at 90° it becomes a square with an outlined right-angle marker. The fixed head and arrow length remain unchanged during the correction.

### Joint-pair vector convention

`choreography/joint-pair.js` owns the standard focus → stretch → release → align sequence. The pose remains translucent while only the referenced joint dots smoothly become solid in their existing colors. The arrow starts after the focus fade; the dots return to pose opacity after stretching completes; only then does the head move to its specified origin. Joint dots have independent materials, so emphasizing one pair never brightens other joints or the bones.

The reference ankle pair, selected shoulder pair, and selected upper-spine pair use this process. The up vector is first drawn between the actual torso/clavicle joints before moving to the coordinate-frame origin. Shared metric recipes declare joint-pair metadata with `jointVector`; the generic explanation renderer applies the same emphasis timing to those sources, sequentially when a step references multiple pairs. Derived global axes and displacement vectors do not invent joint-pair highlights.

### Adding explanation behavior

Keep exported metric calculations and recipe selection in `metrics/`. Define joint inputs in the frame/feature layer; reuse construction and joint-pair choreography rather than copying its emphasis/stretch/release/align stages. Choreography returns deterministic sampled state and must not create DOM or Three.js objects. Renderers consume that state and own their geometry cleanup. Players connect controls to the shared playback clock. Register a specialized presentation in `ui/snapshot.js` only when the common primitive player cannot express it; `snapshot-3d.js` should not need new subtype branches.

The shared clock is tested for pause, offscreen, hidden-tab, inert-card, and disposal behavior. The choreography regression tests retain the existing poses, stage durations, camera alignment, and final metric values through refactors.

### Joint-pair close-ups and metric headers

`choreography/pair-camera.js` provides a perpendicular view of each joint pair, with both the original joints and aligned arrow endpoints included in the framing bounds. Each pair now has a camera-in stage with a settling interval before joint emphasis and growth, followed by a camera-out stage after alignment. The generic primitive pipeline uses the same camera-first rule via `jointPairPresentation`. `ui/camera-framing.js` fits those bounds with padding using the narrower viewport angle. User gestures remain offsets from the explanation camera.

`ui/arrow-shape.js` supplies one closed, flat silhouette for both specialized and generic arrows. Its shaft ends at the arrowhead base, and short arrows scale their shaft and head together without a contrasting outline. `ui/header.js` shows only the larger metric name and a plain-language description from `names.js`; swing IDs and frame indices are omitted.

Axis arrows retain their standard colors, reference/target widths and transparency throughout playback; halos, active-axis thickening, dimming and highlight rings are omitted. `pose-surface.js` treats the skeleton as separate surfaces: complete joint balls and open-ended cylindrical sheets attached at their rims. Both sides of the sheets and balls render when translucent, so overlapping parts remain visible through one another. Joint caps are intact; there are no screen-space overlap masks or artificial seam-normal blending.

The snapshot header contains the metric title and its fixed plain-language explanation. Dynamic stage captions are omitted from the visible UI. The metric navigator sits to the left of the player on desktop.

### Snapshot metric navigator

Configure demos by metric family, subtype, and reconstruction video name:

```json
{
  "kinematic": {
    "torso_turn_bend_tilt": {"00": 300},
    "hip_turn_on_spine_plane": {"03": 200}
  },
  "geometric": {
    "spine_bend_tilt": {"00": 300}
  }
}
```

The example illustrates the format; the saved configuration retains the existing torso demo. Add your other demo choices to populate the navigator. Reusing a video across metrics is supported, and a subtype can have multiple video/frame demos. The navigator groups entries by metric family and uses the shared display-name mapping. It stays on the left on desktop and moves above the viewer on narrow screens. Carousel arrows, dots, rotating cards, and background scenes are removed.

`ui/snapshots.js` owns scene selection/loading; `ui/navigator.js` renders the metric list. `ui/selection.js` serializes scene creation, disposes the previous scene, and discards stale asynchronous selections. Only the selected metric retains a live renderer. Loading and error states keep space reserved for the window. Parser/build checks validate the nested format, authored order, duplicate keys, available metric/video data and frame bounds.

`ui/arrow-projection.js` is shared by all explanation arrows. As an arrow comes within 18° of the camera axis, its projected shape smoothly cross-fades to a fixed-size direction symbol: a dot means toward the viewer and a cross means away. Coordinate-frame arrows also retain their axis letter. The true endpoints, measurement axes, and camera choreography remain unchanged.

`choreography/cross-product.js` supplies an oblique close-up shared by reference and selected axis construction. The camera settles before the plane grows, holds the full input plane and perpendicular result in view through the forward-arrow growth and plane fade, then returns smoothly to the pose view. Bounds include all plane corners and the full result vector.

Each final intrinsic rotation displays two same-color pie surfaces, one for each basis direction that moves around the highlighted axis. Both start from that step’s pre-rotation frame and sweep through the same signed angle; the rotation axis itself gets no pie. `createRotationSectors` reuses the single-sector renderer for this pair.

Snapshot interaction supports screen-space panning: drag shifts the projected view without changing camera position, orientation, or the scripted explanation path. Scroll/pinch changes zoom, and clicking or tapping the canvas toggles explanation playback. Space/Enter on the focused canvas also toggles playback. The canvas exposes its play/pause state to accessibility tools. Separate play/restart buttons are removed; the timeline and component selectors remain. `ui/window-input.js` suppresses click-to-play after a drag or pinch, so zooming cannot accidentally toggle playback. Results video controls retain their existing behavior.

`ui/playback-feedback.js` matches the referenced recording: each window click briefly shows the action’s play/pause icon on a translucent dark circle, then scales and fades away. Repeated clicks replace the previous feedback animation; there is no permanent central button. Reduced-motion mode uses a short fade without scaling.

Axis-set construction uses `choreography/construction-camera.js` to keep one padded set of bounds for the complete construction, including source joint pairs, the plane, and all three axes. The camera enters that close-up once, stays close through the small steps, and pulls back only after the forward vector and plane fade finish. Component removal and the cross product use smooth in-place view changes with the same target and framing distance.

### Overall explanation duration

Set the demo video and frame within each metric subtype. `duration` controls animation time in seconds; `stay` sets the completion review time in seconds:

```json
{
  "kinematic": {
    "torso_turn_bend_tilt": {"video": "00", "frame": 300, "duration": 5, "stay": 2}
  }
}
```

All construction actions, camera movements, rotations, and opening/reset transitions keep their original relative timing. Omit duration to retain the authored tempo. Duration must be a positive finite number; fractional seconds are supported. It is configuration metadata and never becomes a navigator entry. Paused/offscreen time does not count toward active playback time.

`explain/timing.js` scales complete timelines. The deterministic torso choreography and the shared primitive-recipe player both use it, including the initial two-pose view. The scrubber follows the configured total duration.

With `stay` specified, the completion review is excluded from proportional animation scaling. For torso rotation, the camera pulls back to reveal the selected pose, the reference axes fade out and reappear reset while the numbers zero immediately, and turn/bend/tilt replay from one close global view, with a short pause before each rotation. This entire review fits `stay` (two seconds in the example), then the scene resets. `stay: 0` skips the review. Other metric recipes retain a completed-result hold. Omitting timing fields preserves the original tempo.

### Hip rotation on the lower-spine plane

The hip demo uses a dedicated deterministic choreography in `explain/choreography/spine-plane.js`. It builds the complete reference orientation using the shared torso construction, then the lower-spine vector and its perpendicular plane. The reference axes wait at their original position until the plane is ready, move together to the spine origin, and fade Y/Z out before projecting X. Reference X is projected first; its original fades out. The hip joint pair then creates current X, which is projected and faded the same way. Each component removal follows a pie fade and a visible pause. The two projected directions then normalize to a common display length and the reference arrow rotates through the exported signed turn, viewed down the spine. The `stay` interval provides a fade-reset and a second rotation from an oblique global view.

`construction-state.js` shares joint and axis construction with the torso demo. `ui/coordinate-player.js` shares playback, numeric outputs, scrubbing and disposal; `ui/plane.js` provides the reusable centered plane. The same spine-plane choreography accepts shoulder joints for the shoulder variant. Snapshot pan, zoom and click playback apply to both players. The spine-plane camera can pitch and orbit, with its up direction locked to global up to prevent roll.

### Joint-pair stretch camera rule

Before a joint-pair vector stretches, the camera settles into the authored view. That view is adjusted only when the vector is nearly aligned with the camera axis. Screen-left/up placement is not enforced. No roll, endpoint visibility, and the original shared close-up are preserved.

### Shoulder-line turn and tilt

`geometric.shoulder_turn_tilt` has a dedicated visual sequence built from the shared reference prelude and coordinate player. It stretches the right-to-left shoulder vector, creates the reference horizontal plane at the shoulder midpoint, and shows its projection while retaining and then fading the original. Turn rotates reference X around global up to the horizontal projection; tilt rotates that projection toward the original shoulder direction in its difference plane. Magenta angle pies accompany both signed measurements. The camera stays upright, settles before stretches and rotations, and uses the stronger shoulder broadside constraint. The completion review holds the final result before resetting and replaying both measurements within `stay`.

`reference-prelude.js` now supplies the identical reference construction to both spine-plane and shoulder-line demos; `direction-rotation.js` handles horizontal turn and signed elevation independently of presentation.

### Hip turn/tilt and spine bend/tilt

`geometric.hip_turn_tilt` shares the shoulder-line choreography and switches the measured joint pair to right/left hip. `geometric.spine_bend_tilt` uses hip center → shoulder center, projects that spine onto reference XY for forward bend and reference YZ for side tilt, then rotates each projection toward the original spine. It shares the reference prelude, joint-pair presentation, projection motion, difference-plane camera, coordinate player and review timing. `plane-inclination.js` supplies the signed projection-to-source rotations independently of UI code. Both demos retain global up, wait for the reference axes and plane before drawing the target, and hold the completed result before replaying within `stay`.

### Projection display length

Projection and display-length adjustment share one animation. The projected arrow reaches its plane and final normalized display length together; there is no separate normalization step. The original remains visible through that motion, then fades while the projected endpoint stays fixed. This applies to both reference/current spine-plane projections, lateral turn/tilt, spine bend/tilt, and shared primitive projections. Overall configured duration is preserved.

### Projection angle presentation

Projection pies measure the angle between the vector and its plane, closing to 0° as the vector becomes parallel. A second magenta swept pie highlights the angle removed between the original and moving arrow; it remains visible until the original fades. `planeProjectionAngle` supplies the shared wedge and label directions; projection no longer uses a normal-to-vector 90° pie or square marker. Unused reference up arrows fade once the plane is established. The lower-spine axis is hidden after plane setup and stays hidden through rotation, review and reset. The reference-orientation construction retains its own existing axis-building animation.

### Direct references for spine inclination

Spine forward bend and side tilt now skip the projection animation. After each plane is established, its reference direction fades in at the final position and display length, colored to match that plane (orange for XY/bend, violet for YZ/tilt). The actual spine remains cyan at its full joint-to-joint length; each reference vector matches that length. After a short pause the reference rotates toward the spine, with the magenta angle pie and numeric result. This also applies during the completion review; other metrics keep their projection sequences.

### Shared result-first opening

Every metric starts with only the current pose and its final values, holds briefly, then fades in the reference pose while resetting the numbers to zero. The existing construction starts after that transition. `choreography/opening.js` supplies the same opening to dedicated coordinate choreographies and the primitive recipe player. The added opening remains within the configured animation duration; completion review still uses `stay`. Dedicated loops finish with the reference hidden so replay returns cleanly to the result preview.

### Ground and translucent shadows

The ground remains opaque and receives shadows independently of the camera viewpoint. Scripted snapshot cameras stay above its surface. `pose-shadow.js` preserves the template’s continuous PCF shadow silhouette and fades overall light shadow strength with pose visibility. It uses no alpha-hashed depth material or random pixel rejection, avoiding speckled shadows.

### Spine orientation as a rigid T

`geometric.spine_azimuth_polar_spin` shows the hip-to-shoulder spine as a cyan stem and the shoulder direction across it as a violet crossbar. After reference construction, all three axes move together: left and up form a T rooted at the hip midpoint, and forward starts at that same root. They stay visible while the body T is constructed. The actual joint pairs are emphasized and stretched first; arrows smoothly become bars, and the shoulder direction is projected perpendicular to the spine. Once the top-down camera settles, a horizontal plane grows at the root. All three reference directions rotate together for azimuth, then forward fades before polar inclination and spine-axis spin. The reference stem remains visible from above. T lengths and right angles remain fixed during rotation. Magenta pies accompany the measurements, with two wedges for the opposite halves of the twisting crossbar. The faint skeleton supplies context throughout.

`t-orientation.js` samples the same Ry(azimuth) Rx(polar) baseline and signed spine-axis spin as the computation. `spine-t.js` composes the shared result-first opening, reference prelude, source-pair presentation, projection, upright cameras, completion hold and review. The coordinate renderer supports flat bars as well as arrows, so T presentation remains modular. The demo is configured for video 00, frame 300, duration 40 seconds and stay 10 seconds.

### Hip displacement in normalized length units

`position.hip_sway_thrust_lift` now has a dedicated animation. It shares the result-first opening and reference-axis construction, moves the unchanged reference axes to the reference hip center, and highlights the ten reference bones used by `VanillaPoseScaler` without highlighting joints. Rounded bone copies align beside the pose and average into a unit bone; that bone moves to the reference axes before they resize to one unit and the sample fades. The axes stay at the reference hip center. The current pose fades in, the camera closes in while the axes become thinner and translucent, and both root-center markers fade in before the animation separates the signed displacement into X (sideways), Z (forward), and Y (vertical) components. Their arrows grow together with the numerical values. Solid, axis-colored lines extend from the reference-root origin; matching dashed connectors link the moving point to the active measured axis. Only the active axis’s guides appear, with smooth fades during the pauses; the same presentation replays during review. `displacement-guides.js` isolates this projection geometry. Completion holds the result and reviews the three components with short pauses while keeping the measurement camera fixed; `duration` and `stay` control the two periods.

`displacement-geometry.js` isolates source-coordinate normalization, reference bone selection and the signed component chain. `hip-displacement.js` supplies the choreography; `measurement-guides.js` supplies reusable flat arrows, bars, rulers, dashed connectors and anchored points. `bone-guides.js` supplies physical capsule copies with rounded ends; bone-only emphasis is separate from joint emphasis. The shared coordinate player reads each metric’s unit, so displacement values display normalized units while angular values retain degrees. The snapshot entry uses video 00, frame 300, duration 40 seconds and stay 10 seconds.


### Default visibility transitions

`choreography/visibility.js` audits all eight coordinate-animation timelines and supplies short, deterministic opacity fades for otherwise abrupt component appearances and removals. It covers poses, individual axes, construction-angle markers, planes, measurement pies, flat guides and copied bones. Existing explicit fades and geometry-driven growth/shrink animations retain their timing. Unchanged arrows handed between rendering layers stay continuous. Angle pies keep their identity through completion holds. All fades run inside the configured `duration` and `stay`, including when scrubbing or replaying; camera paths and numerical values are untouched.

### Rotation-axis brightness

`rotation-highlight.js` highlights the actual rotation line with brighter violet, cyan or orange during motion, using a smooth color ramp. It matches both direction and pivot rather than brightening a parallel but displaced vector. Only existing visible axes can brighten; highlighting never creates a hidden or absent axis. The same helper is used during completion reviews. Line widths and magenta angle pies remain unchanged.


Reference-direction resets during angular review use `referenceResetOpacity` in `review-timing.js`: fade out, change direction while fully hidden, hold a short hidden pause, then fade in. The pause is bounded by the available review interval, so `stay` does not grow and the reset cannot flash between the two directions.


Target vectors also fade explicitly during angular review resets. `fadeReviewTarget` handles changes of target direction within an existing renderer, including the horizontal-to-inclined target switch between shoulder/hip turn and tilt. These fade out, reset while hidden, then fade in; detecting component presence alone would miss them.

### Short in-window step captions

`captions.js` keeps concise action-and-purpose wording separate from choreography and rendering. It covers every step of the eight metric demos, including preparation, measurement and review. `ui/captions.js` displays the text at the bottom of the 3D window on a translucent dark green background, cross-fading during playback and updating immediately when seeking. The overlay does not intercept clicks, pan or zoom, and respects reduced-motion settings. Fixed header descriptions remain available above the window.
