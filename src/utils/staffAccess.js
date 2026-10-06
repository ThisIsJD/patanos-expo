// Presentation guard only. Database RLS/RPCs still authorize every remote operation.
export function hasStaffAccess(session, profile) {
  return Boolean(session?.user?.id && profile?.id === session.user.id
    && ['admin', 'cashier'].includes(profile.role) && profile.is_enabled !== false)
}
