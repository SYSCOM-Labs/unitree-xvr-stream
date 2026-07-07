const TOUR_STORAGE_KEY = 'syscom_xvr_tour_completed'

export function hasCompletedTour(): boolean {
  try {
    if (localStorage.getItem(TOUR_STORAGE_KEY) === 'true') {
      return true
    }
    if (localStorage.getItem('syscom_tour_completed') === 'true') {
      markTourCompleted()
      return true
    }
  } catch {
    return false
  }
  return false
}

export function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true')
  } catch {
    // ignore private mode / blocked storage
  }
}
