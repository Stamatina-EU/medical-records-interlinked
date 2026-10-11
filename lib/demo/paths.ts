import path from "node:path";
export const RICH_RUNTIME_DIR=path.join(process.cwd(),"data","runtime","rich-default");
export const RICH_OVERLAY=path.join(RICH_RUNTIME_DIR,"state.json");
export const RICH_PENDING=path.join(RICH_RUNTIME_DIR,"pending");
export const RICH_UPLOADS=path.join(RICH_RUNTIME_DIR,"documents");
/** Checked absolute paths before any recursive deletion. */
export function checkedRichPath(candidate:string, runtimeRoot=RICH_RUNTIME_DIR):string {
  const root=path.resolve(runtimeRoot), target=path.resolve(candidate);
  if(target!==root && !target.startsWith(root+path.sep)) throw new Error("Path outside rich runtime");
  return target;
}
