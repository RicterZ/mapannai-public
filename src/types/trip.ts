export interface Trip {
  id: string           // "trip_${uuid}"
  name: string         // "东京2024"
  description?: string
  startDate: string    // ISO date "2024-03-01"
  endDate: string      // ISO date "2024-03-07"
  coverImage?: string
  createdAt: string
  updatedAt: string
}

export interface TripDay {
  id: string           // "day_${uuid}"
  tripId: string
  date: string         // ISO date "2024-03-01" — bound to real calendar date
  title?: string       // optional custom title; if empty display "第N天 · 3月1日"
  markerIds: string[]  // ordered list of marker IDs for this day
}

export type ActiveViewMode = 'overview' | 'trip' | 'day'

export interface ActiveView {
  mode: ActiveViewMode
  tripId: string | null
  dayId: string | null
}
