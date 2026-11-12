/* Compatibility for saved Summit selections and existing integrations. */
globalThis.DriftSummit=Object.freeze({id:201,info:()=>DriftNFS.info(201),createTrack:Track=>DriftNFS.createTrack(Track,201)});
