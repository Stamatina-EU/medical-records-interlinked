import { readRichState } from "../lib/rich/read";
readRichState().then(state=>console.log(`verify:rich passed — ${state.facts.length} rich source facts / ${state.documents.length} PDFs; immutable code-owned fixture.`)).catch(e=>{console.error(e);process.exit(1)});
