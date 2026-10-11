import { describe,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { navigationPatientName } from "@/lib/rich/navigation";
describe("rich layout isolation, including a missing default runtime",()=>{
 it("selects only the immutable rich reader; never invokes the default initializer",async()=>{
  const defaultReader=vi.fn(async()=>{throw new Error("would initialize default runtime");});
  const richReader=vi.fn(async()=>({patient:{displayName:"Rich fictional patient"}}));
  expect(await navigationPatientName("rich-synthetic",defaultReader,richReader)).toBe("Rich fictional patient");
  expect(defaultReader).not.toHaveBeenCalled();expect(richReader).toHaveBeenCalledOnce();
 });
 it("keeps the original default reader on default routes",async()=>{
  const defaultReader=vi.fn(async()=>({patient:{displayName:"Default patient"}})),richReader=vi.fn();
  expect(await navigationPatientName("hackathon",defaultReader,richReader)).toBe("Default patient");
  expect(defaultReader).toHaveBeenCalledOnce();expect(richReader).not.toHaveBeenCalled();
 });
 it.each(["/rich","/rich/laboratory","/rich/history","/rich/sources","/rich/summary"])("sets the rich render profile from %s",pathname=>{
  const response=proxy(new NextRequest("http://localhost"+pathname,{headers:{"x-mri-render-profile":"hackathon"}}));
  expect(response.headers.get("x-middleware-request-x-mri-render-profile")).toBe("rich-synthetic");
 });
 it.each(["/","/sources","/history/iron","/summary","/richer"])("does not let a supplied rich header change %s",pathname=>{
  const response=proxy(new NextRequest("http://localhost"+pathname,{headers:{"x-mri-render-profile":"rich-synthetic"}}));
  expect(response.headers.get("x-middleware-request-x-mri-render-profile")).toBe("hackathon");
 });
});
