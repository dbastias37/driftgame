# Engine Audio System V2 — capture pending

## Current status

The sample player replaces the oscillator synthesizer on this branch only.
**No Engine Simulator recordings have been generated, imported or listened to.**
All five banks intentionally have `status: pending`; the engine is silent on this
branch until its bank is verified. Do not merge/deploy this branch as a finished
sound replacement. Main retains its existing audio until the AE86 is approved.

The supplied `engine-sim-v0.1.14a.zip` was inspected. SHA-256:
`2fc1e7c2ad6a94af4bbe78e69907b57aad3d5ebda7d55563e24fa2e14707fbe6`.
It contains a Windows PE32+ executable, engine scripts, and escape impulse
responses, referenced explicitly by `es/sound-library/impulse_responses.mr`.
Those responses last roughly 0.21–0.96 seconds and are not sustained RPM loops.
The default `assets/main.mr` loads `engines/rotary/4_rotor.mr`, not a 4A-GE.
No identifiable 4A-GE definition was found in the archive. This Linux workspace
has no Wine executable. Capturing the supplied Windows application here was
therefore not possible. The archive assets were not redistributed.

## Recording handoff: AE86 first

1. Load a documented Toyota 4A-GE engine definition compatible with the simulator.
   Preserve its `.mr` file, imported dependencies, source URL/author and license.
   Do not label the supplied four-rotor sound as an AE86.
2. Capture the simulator's internal output, not a microphone. Disable music,
   voice, automatic gain, denoising and other processing. Prefer lossless WAV,
   48 kHz, PCM16 or PCM24. Retain unedited originals; runtime delivery is PCM16.
3. Make a short pilot: idle, 3500 RPM under load, then a slow closed-throttle
   deceleration. Check it before recording the full set.
4. Target 900, 1500, 2500, 3500, 4500, 5500, 6500 and 7800 RPM, only within the
   definition's operating range. Capture about 10 seconds per stable anchor;
   exclude starter, settling and changing settings. Use dynamometer load to
   hold the on-throttle anchors. Log actual RPM and throttle/load setting.
5. Capture separate off-throttle/overrun audio. If steady motored RPM is not
   possible, record repeated slow decelerations; these require review and may
   not yield usable loops at every anchor. Do not relabel on-load audio as off-load.
6. Keep consistent output gain across takes, peaks around -6 dBFS, no clipping.
   Name files `ae86_on_3500.wav` / `ae86_off_3500.wav`. Include a screen recording
   or log showing engine identity, RPM and load where possible.
7. Prepare 2–5 second loops from stable regions, align cycle boundaries, and
   crossfade the loop seam. Check DC, clipping, pitch stability and clicks.
   Preserve relative on/off loudness; use conservative manifest gain trims.
8. Listen to idle, slow RPM sweeps, rapid throttle changes, up/down shifts,
   braking, pauses and volume changes in-browser before marking verified.

These are recordings **of a simulation**, not recordings of a real car.

## Bank contract

Each vehicle has `assets/audio/engines/<skin>/bank.json`:

- `fujiwara`: Toyota AE86, 4A-GE (first validation target).
- `blue`: Nissan Skyline R34, RB26.
- `yellow`: Mazda RX-7 FD, 13B (not four rotor).
- `gray`: Chevrolet Nova SS, V8; document the specific engine captured.
- `yugo`: Yugo Koral 55, I4; document the specific engine captured.

Pending banks have empty `on` and `off` layers. After actual capture/review,
`status` can become `verified`. Required provenance fields:
`type: engine-simulator-capture`, `engineDefinition`,
`engineDefinitionSha256`, `captureDate`, `reviewedBy`, `license`.
Preserve source references and capture notes in additional provenance fields.
Each layer has 3–16 ordered anchors, covering idle through redline, with no
successive RPM ratio above 2. Each entry has:

```json
{
  "rpm": 3500,
  "url": "assets/audio/engines/fujiwara/on_3500.wav",
  "loopStart": 0.1,
  "loopEnd": 3.1,
  "gain": 0.7,
  "sha256": "<actual SHA-256 of the final WAV bytes>"
}
```

Never substitute mock fixtures, impulse responses, or resynthesized oscillators
for capture files. Metadata and checksums establish identity, not acoustic
quality: listening review is still mandatory.

## Runtime

`DriftEngineAudio` retains the unlock/update/volume/dispose API. `getStatus()`
reports idle/loading/pending/ready/error and whether the loaded bank passed
validation. RPMModel reads speed, gearMax, gear, braking and throttleSm without
writing to the car. Audio-only clutch slip fades out by 12 km/h. A shift uses
the new gear's RPM mapping and a brief load dip, without altering transmission.
Two adjacent RPM anchors blend with equal-power curves; on/off layers also
blend with equal-power curves. Playback-rate adjustment is bounded to 0.5–2.
All loops in the selected bank run in sync (up to 32 sources, typically 16);
only four have nonzero target gains. Only one bank is resident. No oscillator
fallback. Pause/hidden/pagehide/mute silence output; disposal releases nodes.
Samples are checksum-checked and decoded before any bank becomes audible.

## Validation and release

- `npm run test:audio`: scheduling/model tests using explicitly fake PCM fixtures.
- `npm run test:core`: existing driving/gameplay suite plus audio tests.
- `npm run audio:verify -- fujiwara`: AE86 capture gate.
- `npm run audio:verify`: all-five release gate (currently expected to fail).

The release gate checks provenance, RPM coverage, WAV encoding, checksums,
clipping, silence and loop endpoint discontinuity. It cannot approve timbre or
prove engine authenticity automatically. Off/on crossfade loudness and phasing
must be reviewed by listening. No real captured-audio listening test has passed.
After AE86 approval, repeat capture and listening tests for the other four;
profile support alone is not completed vehicle-specific sound.

## Render preparation

This is a static browser-audio change. Preserve the current frontend static-site
configuration and multiplayer service. `npm start` starts only the room server;
it does not serve index.html or samples. No new Render service is required.

Before deployment, select/confirm the existing Render workspace, inspect the
frontend service's branch and publish directory, and require
`npm run test:core && npm run audio:verify` as a release preflight. Retain
`assets/audio/engines` in the published directory and confirm WAV URLs return
200 with audio content rather than an HTML fallback. Test an actual browser
gesture to unlock audio, AE86 race/shift/braking/pause and the other vehicles.
Do not deploy while the capture gate is blocked. Roll back to the prior frontend
commit if audio validation fails. No Render configuration or deploy was changed:
there was no selected workspace during this implementation.

## Implementation verification (2026-11-10)

The final core regression suite passed (207 tests, including 10 audio tests).
The full `npm test` run passed those 207 tests; its 10 browser tests failed at
setup because the Playwright browser binary is not installed. Browser audio verification was attempted with Chromium
but the environment refused its process socket (`Operation not permitted`);
there is no claim of a completed browser playback or listening test. Run the
browser acceptance steps above after capture. Unit fixtures are mocked PCM,
not engine recordings. The all-five capture release gate correctly fails while
banks are pending.
