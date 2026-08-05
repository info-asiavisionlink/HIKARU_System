import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/callback', '/api/auth']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  const role = request.cookies.get('hk_s_role')?.value
  const uid  = request.cookies.get('hk_s_uid')?.value

  // パブリックページ（/login はそのまま表示・他アプリへのリダイレクトなし）
  if (isPublicPath(pathname)) {
    if (uid && role && pathname === '/login') {
      if (role === 'worker') return NextResponse.redirect(new URL('/home', request.url))
      if (role === 'client') return NextResponse.redirect(new URL('/client', request.url))
    }
    return response
  }

  // ルートリダイレクト
  if (pathname === '/') {
    if (!role || !uid) return NextResponse.redirect(new URL('/login', request.url))
    if (role === 'worker') return NextResponse.redirect(new URL('/home', request.url))
    if (role === 'client') return NextResponse.redirect(new URL('/client', request.url))
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 未認証
  if (!role || !uid) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // /client は client ロールのみ
  if (pathname.startsWith('/client') && role !== 'client') {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // worker パスは worker ロールのみ
  const workerPaths = ['/jobs', '/home', '/profile', '/notifications']
  if (workerPaths.some((p) => pathname.startsWith(p)) && role !== 'worker') {
    return NextResponse.redirect(new URL('/client', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
