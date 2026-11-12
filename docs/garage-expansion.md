# Garage expansion — 1.0.0-prealpha.24

Four supplied vehicle models join the existing six: Subaru Impreza WRX STI S206 NBR, BMW M3 GTR E46 Straßenversion, Ford Shelby GT500 (2013), and Ford Mustang GT Fastback. Original textures are embedded, four wheel pivots animate independently, headlights and brake lights respond to driving, and paint masks protect trim and glass. The BMW uses the intact source meshes and excludes overlapping damaged variants.

Each vehicle has a game handling profile, engine synthesis profile, workshop progression, fitted wheel contacts, and authoritative online registration. Handling values are game balancing choices, not claims of measured real-world performance. Existing saves retain all previous cars and receive the four new upgrade slots.

The garage now offers a horizontal catalog with direct selection, thumbnails, drivetrain labels and selected state; previous/next buttons remain available. Visible zoom buttons, wheel/pinch controls and reset share garage bounds of 0.85–1.18. The camera stays inside the room, adapts its field of view to portrait layouts, ignores garage panning, and resets when changing preview modes. Map zoom keeps its separate range.

New GLBs load only when selected or needed for a rival, with shared cached requests. Late responses cannot replace a newer selection or restore disposed scenes. Failed loads show a message rather than repeatedly downloading every frame. The four new models total approximately 10.1 MB before HTTP transfer compression.

Validation: `npm run test:core` — 273 tests passed, zero failures. Includes source geometry, grounded wheels, light/paint separation, delayed loading, camera bounds and framing, offline/online setup, legacy tracks and physics. Browser interaction checked catalog selection and actual textured garage models in the compatible renderer. This environment does not expose hardware WebGL; GPU performance and physical touch-device feel remain outside that check.

Assets were supplied by the project owner. Original creator/license metadata was not present in the four archives; credits state that limitation rather than inventing attribution. Conversion scripts and fitted dimensions are included for reproducibility.
