# NFS III Especial — prealpha.22

The imported road floor no longer doubles as an invisible fence. Guardrails and rock walls now use spatially indexed triangles extracted from the supplied GLBs. Contacts are sliced at vehicle height, so arch openings and airborne clearance remain open. Swept body contacts retain lateral travel and provide a bounded frontal rebound; reversing can separate from a wall.

Wheel hubs retain their chassis attachment and have limited suspension travel. Missing road support can launch the car, while roofs are queried at the actual position instead of extending a tunnel feature across every nearby shortcut.

Rolling grid presentation samples the displayed car's elevation before constructing the opening shot. Cameras also stop in front of solid rock geometry. Quick Race and Time Trial group their tracks into native expandable categories.

The scenery loader welds sub-centimetre import seams, removes duplicate coplanar triangles, and disables atlas mip bleeding. Redrock's brightness-based alpha is normalized to cutout transparency so dark asphalt/rock stays opaque. Original GLB files and texture colors remain unchanged. The Redrock AI guide is offset away from the rock seam between stations 6470 and 7300.

Rebuild collision data with `python scripts/build-nfs-colliders.py` after regenerating the native driving data. Requires NumPy, SciPy and Pillow. The script reads the versioned GLBs and existing road data.

Validation: core simulation/renderer suite; new swept-impact, rebound, sliding, reverse escape, arch/jump clearance, wheel attachment and opening-shot regression tests; three 700-second AI simulations; software-rendered views of each NFS starting grid and the Redrock canyon. Local Chromium/WebGL browser validation was unavailable in this execution environment.
