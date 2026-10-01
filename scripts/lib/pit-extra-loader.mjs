// Served by the dev server to scripts/pit-extra-stills.mjs's page (vite rewrites the bare imports): loads a GLB from public/pit/extra/ whole, with the
// meshopt decoder, the way three's GLTFLoader reads any GLB (the game's prop() keeps only the first mesh; the gate machinery is nine nodes).
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
export const loadExtra = async (file) => (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/pit/extra/${file}.glb`)).scene;
