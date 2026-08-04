import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/callback']

function isPublicPath(pathname: string): boolean {
  // API ルートはミドルウェア認証をスキップ（API 側で認証を行う）
  if (pathname.startsWith('/api/')) return true
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  const role = request.cookies.get('hk_c_role')?.value
  const uid  = request.cookies.get('hk_c_uid')?.value

  // API・パブリックページはそのまま通す
  if (isPublicPath(pathname)) {
    if (role === 'admin' && uid && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // ルートリダイレクト
  if (pathname === '/') {
    if (role === 'admin') return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 未認証
  if (!role || !uid) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // CONSOLE は admin のみ
  if (role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
