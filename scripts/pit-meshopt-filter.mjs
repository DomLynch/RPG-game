// World's Pit intake, step 2 (after scripts/pit-ship.mjs): meshopt with the FILTER method, so POSITION stays float in real metres and no
// dequantisation transform lands on the node (the Pit's prop() takes the raw geometry). Run where @gltf-transform + meshoptimizer are installed.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { reorder } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import fs from "node:fs";
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  await doc.transform(reorder({ encoder: MeshoptEncoder }));
  doc.createExtension(KHRMeshQuantization).setRequired(true);   // the filter stores NORMAL/TANGENT as normalized bytes; this extension is what allows that format
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(f, doc);
  console.log(f, fs.statSync(f).size);
}
