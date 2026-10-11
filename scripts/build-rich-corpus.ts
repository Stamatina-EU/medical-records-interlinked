/** Rebuild ONLY the rich fixture PDFs. Never writes the default seed or demo-files. */
import { chromium } from "playwright";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
async function main() {
  const src=path.join(process.cwd(),"corpus","rich"), out=path.join(process.cwd(),"data","rich-synthetic","documents");
  await mkdir(out,{recursive:true});
  const browser=await chromium.launch({channel:"msedge",headless:true});
  try {
    const page=await browser.newPage();
    for(const file of (await readdir(src)).filter(f=>f.endsWith(".html")).sort()) {
      await page.goto(pathToFileURL(path.join(src,file)).href,{waitUntil:"load"});
      await page.pdf({path:path.join(out,file.replace(/\.html$/,".pdf")),format:"A4",printBackground:true,preferCSSPageSize:true});
      console.log("Built rich fixture PDF: "+file.replace(/\.html$/,".pdf"));
    }
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1)});
