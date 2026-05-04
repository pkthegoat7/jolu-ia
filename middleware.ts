import { NextRequest, NextResponse } from 'next/server';

// Presence of the HttpOnly cookie means the user authenticated via the server.
// Full JWT signature verification happens in every API route handler.
export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/dashboard/:path*', '/admin/leads/:path*'],
};
