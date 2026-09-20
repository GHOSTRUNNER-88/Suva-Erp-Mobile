// Scans app source for identifiers referenced but never declared/imported —
// the `ReferenceError: Property 'apiFetch' doesn't exist` class of crash,
// which only surfaces at runtime on the screen that hits it.
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverseMod = require("@babel/traverse");
const traverse = traverseMod.default || traverseMod;

const GLOBALS = new Set([
  "console","require","module","exports","process","global","globalThis","__DEV__","ErrorUtils",
  "setTimeout","clearTimeout","setInterval","clearInterval","fetch","Promise","JSON","Math","Date",
  "Object","Array","String","Number","Boolean","Error","Map","Set","WeakMap","WeakSet","Symbol",
  "RegExp","parseInt","parseFloat","isNaN","isFinite","encodeURIComponent","decodeURIComponent",
  "AbortController","FormData","URL","URLSearchParams","TextEncoder","TextDecoder","Intl","Buffer",
  "requestAnimationFrame","cancelAnimationFrame","navigator","undefined","NaN","Infinity","structuredClone",
  "arguments","Blob","File","FileReader","XMLHttpRequest","WebSocket","atob","btoa","queueMicrotask","Proxy","Reflect","BigInt",
  // `window` is always typeof-guarded in RN code here; __dirname/__filename are
  // for the plain-CJS check scripts, which this parses as modules.
  "window","__dirname","__filename",
]);

const DIRS = ["app","screens","components","lib","auth","firebase","i18n","theme"];
const files = [];
function walk(d){
  if(!fs.existsSync(d)) return;
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const p = path.join(d,e.name);
    if(e.isDirectory()) walk(p);
    else if(e.name.endsWith(".js")) files.push(p);
  }
}
DIRS.forEach(walk);

const TARGET = [...new Set(files)];
const findings = [];
for(const f of TARGET){
  let ast;
  try{
    ast = parser.parse(fs.readFileSync(f,"utf8"),{sourceType:"module",plugins:["jsx","classProperties","optionalChaining","nullishCoalescingOperator"]});
  }catch(e){ findings.push({f,name:"<parse error>",line:0,msg:e.message.split("\n")[0]}); continue; }
  traverse(ast,{
    ReferencedIdentifier(p){
      const n = p.node.name;
      if(GLOBALS.has(n)) return;
      if(p.scope.hasBinding(n,true)) return;
      findings.push({f,name:n,line:p.node.loc?p.node.loc.start.line:0});
    },
  });
}
if(!findings.length){ console.log("no undefined identifiers found"); process.exit(0); }
const seen = new Set();
for(const x of findings){
  const k = x.f+":"+x.name;
  if(seen.has(k)) continue;
  seen.add(k);
  console.log(`${x.f}:${x.line}  ${x.name}${x.msg?"  "+x.msg:""}`);
}
process.exit(1);
