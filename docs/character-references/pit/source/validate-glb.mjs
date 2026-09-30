import fs from 'node:fs';import path from 'node:path';import validator from 'gltf-validator';
const files=process.argv.slice(2);let errors=0;
for(const file of files){const b=fs.readFileSync(file);const r=await validator.validateBytes(new Uint8Array(b),{maxIssues:10000});fs.writeFileSync(file+'.validation.json',JSON.stringify(r,null,2));console.log(JSON.stringify({file,errors:r.issues.numErrors,warnings:r.issues.numWarnings}));errors+=r.issues.numErrors;}
process.exitCode=errors?1:0;
