import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const ADMIN_ONLY_ROUTES = [
  '/finance',
  '/payouts',
  '/settings',
  '/vehicle-types',
  '/service-areas',
  '/addons',
  '/legal',
]

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next({ request })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing in proxy.')
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          const isDev = process.env.NODE_ENV !== 'production'
          response.cookies.set(name, value, { ...options, secure: isDev ? false : options?.secure })
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicRoute = pathname === '/login' || pathname.startsWith('/api/')

  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/'
    return NextResponse.redirect(dashboardUrl)
  }

  if (user && supabaseServiceKey && !isPublicRoute) {
    const isAdminOnlyRoute = ADMIN_ONLY_ROUTES.some((route) => pathname.startsWith(route))

    if (isAdminOnlyRoute) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const { data: adminRecord } = await supabaseAdmin
        .from('admins')
        .select('role')
        .eq('email', user.email?.toLowerCase().trim() || '')
        .single()

      if (adminRecord?.role === 'manager') {
        const dashboardUrl = request.nextUrl.clone()
        dashboardUrl.pathname = '/'
        return NextResponse.redirect(dashboardUrl)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
