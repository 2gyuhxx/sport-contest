import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { SearchPage } from '../pages/SearchPage'
import { EventDetailPage } from '../pages/EventDetailPage'
import { CreateEventPage } from '../pages/CreateEventPage'
import { AppShell } from '../ui/AppShell'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/admin/events/create" element={<CreateEventPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
