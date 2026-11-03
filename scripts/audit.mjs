import {open} from 'node:fs/promises';
import {parseInput,validateCase,validateStudyPack,ImportError} from '../app/parser.mjs';
import {importRegistry} from '../app/registry.mjs';
import {evaluateAll} from '../app/engine.mjs';
import {STUDIES} from '../app/trials.mjs';
import {reportJSON,reportCSV,reportHTML} from '../app/exports.mjs';
import {LIMITS} from '../app/catalog.mjs';
const HELP='Usage: node scripts/audit.mjs [case-file] [--studies pack-file] [--format json|csv|html]\nRead a synthetic case from stdin when case-file is omitted. Optional studies: local study pack or ClinicalTrials.gov v2 JSON.\nExit 0: no detected criterion barriers (unknowns may remain); 1: at least one criterion barrier; 2: import or usage error. Never an eligibility decision.\n';
async function read(path){
 const chunks=[];let bytes=0,handle;
 try{const stream=path?(handle=await open(path,'r')).createReadStream():process.stdin;
  for await(const chunk of stream){bytes+=chunk.length;if(bytes>LIMITS.bytes)throw new ImportError('limit','Input exceeds the 2 MiB limit.');chunks.push(chunk);}
 }finally{await handle?.close();}
 return parseInput(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
}
async function main(){
 const args=process.argv.slice(2);let path=null,studyPath=null,format='json';
 if(args.length===1&&args[0]==='--help'){process.stdout.write(HELP);return;}
 for(let i=0;i<args.length;i++){
  const a=args[i];
  if(a==='--format'){format=args[++i];if(!['json','csv','html'].includes(format))throw new Error('usage');}
  else if(a==='--studies'){studyPath=args[++i];if(!studyPath||studyPath.startsWith('-'))throw new Error('usage');}
  else if(a.startsWith('-')||path!==null)throw new Error('usage');else path=a;
 }
 const c=validateCase(await read(path));let studies=STUDIES;
 if(studyPath){const input=await read(studyPath);studies=input.schema==='eligibility-study-pack.v1'?validateStudyPack(input):importRegistry(input);}
 const results=evaluateAll(studies,c),content=format==='html'?reportHTML(studies,c,results):format==='csv'?reportCSV(studies,c,results):reportJSON(studies,c,results);
 process.stdout.write(content);process.exitCode=results.some(r=>r.status==='does_not_meet')?1:0;
}
main().catch(error=>{process.stderr.write(error instanceof ImportError?`Review not completed: ${error.message}\n`:'Review not completed. Check arguments, readable UTF-8 JSON, and --help.\n');process.exitCode=2;});
