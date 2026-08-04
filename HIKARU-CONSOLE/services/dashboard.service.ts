export interface DashboardStats {
  projects: {
    total: number
    active: number
    paused: number
    completed: number
    cancelled: number
    spot: number
    recurring: number
    hotel: number
  }
  stores: { total: number; active: number }
  clients: { total: number; active: number }
  employees: {
    total: number; active: number; on_leave: number; resigned: number; suspended: number
  }
  partners: {
    total: number; active: number; suspended: number; terminated: number
  }
  revenue: {
    this_month: number
    this_year:  number
    unbilled:   number
    unpaid:     number
    by_type: { spot: number; recurring: number; hotel: number }
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/dashboard', {
    credentials: 'include',
    cache: 'no-store',
  })

  if (!res.ok) {
    return {
      projects:  { total: 0, active: 0, paused: 0, completed: 0, cancelled: 0, spot: 0, recurring: 0, hotel: 0 },
      stores:    { total: 0, active: 0 },
      clients:   { total: 0, active: 0 },
      employees: { total: 0, active: 0, on_leave: 0, resigned: 0, suspended: 0 },
      partners:  { total: 0, active: 0, suspended: 0, terminated: 0 },
      revenue:   { this_month: 0, this_year: 0, unbilled: 0, unpaid: 0, by_type: { spot: 0, recurring: 0, hotel: 0 } },
    }
  }

  return res.json()
}
