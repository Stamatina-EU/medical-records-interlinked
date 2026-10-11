/** Select a server-owned profile for this process only; no persisted UI profile switch. */
import { spawn } from "node:child_process";
import path from "node:path";
const profile=process.argv[2],mode=process.argv[3];
if(!["rich","legacy"].includes(profile)||!["dev","start"].includes(mode))throw new Error("Use run-profile rich|legacy dev|start");
const child=spawn(process.execPath,[path.join(process.cwd(),"node_modules","next","dist","bin","next"),mode,"-H","127.0.0.1",...process.argv.slice(4)],{cwd:process.cwd(),env:{...process.env,MRI_DEMO_PROFILE:profile},stdio:"inherit",windowsHide:true});
child.on("exit",code=>{process.exitCode=code??1;});
