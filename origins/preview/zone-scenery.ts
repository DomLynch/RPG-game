// Zone scenery (World lane): the surfaces a zone's pieces are built from. Zones import nothing from the Pit (src/arena*.ts): the Exchange and the Frontier take these
// materials, whoever made them (today main.ts hands over the Pit's, until the zone's own are built here).
import type * as THREE from 'three';

export type ZoneMaterials = { sand: THREE.MeshStandardMaterial; stone: THREE.MeshStandardMaterial; iron: THREE.MeshStandardMaterial; cloth: THREE.MeshStandardMaterial; coal: THREE.MeshStandardMaterial };
