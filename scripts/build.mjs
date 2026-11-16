import {readFile,writeFile,cp,rm} from 'node:fs/promises';
import {build} from 'esbuild';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const pkg=JSON.parse(await readFile('package.json','utf8'));
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!url||!key||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)||!key.startsWith('sb_publishable_'))throw Error('Set SUPABASE_URL and a publishable (not secret/service_role) key before building.');
await writeFile('public/cloud-config.js','window.LEARNING_CONFIG='+JSON.stringify({url,key,course:pkg.learning.course,passwordRecoveryEnabled:process.env.AUTH_REDIRECTS_READY==='true'})+';\n');
await build({entryPoints:['src/cloud.js'],outfile:'public/cloud.bundle.js',bundle:true,format:'iife',platform:'browser',target:['es2022'],minify:true,legalComments:'none'});
await rm('dist',{recursive:true,force:true});await cp('public','dist',{recursive:true});
console.log('Built '+pkg.name+' with Supabase authenticated cloud storage.');
