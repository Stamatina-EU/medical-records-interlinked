import { NextResponse,type NextRequest } from "next/server";
/** Internal render profile comes from the route, never from a supplied client header.
 * No rewrites, redirects, session changes or mutation API interception.
 */
export function proxy(request:NextRequest) {
 const pathname=request.nextUrl.pathname;
 const rich=pathname==="/rich" || pathname.startsWith("/rich/");
 const requestHeaders=new Headers(request.headers);
 requestHeaders.set("x-mri-render-profile",rich?"rich-synthetic":"hackathon");
 return NextResponse.next({request:{headers:requestHeaders}});
}
export const config={matcher:["/","/history/:path*","/sources/:path*","/summary/:path*","/rich/:path*"]};
