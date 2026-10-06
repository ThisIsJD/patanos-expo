import React from 'react'
import { beforeEach, expect, jest, test } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react-native'
import { Alert } from 'react-native'
import StaffAdministration from '@/src/components/auth/StaffAdministration'
import { useStaffAdministration } from '@/src/hooks/useStaffAdministration'

jest.mock('@/src/hooks/useStaffAdministration', () => ({ useStaffAdministration: jest.fn() }))
let administration
beforeEach(() => {
  administration = { ownerId: 'owner', isOnline: true, busy: false, loading: false, error: null,
    staff: [{ id: 'owner', email: 'admin@patanos.test', role: 'admin', is_enabled: true },
      { id: 'cashier', email: 'cashier@patanos.test', role: 'cashier', is_enabled: false }],
    refresh: jest.fn(), save: jest.fn().mockResolvedValue({ saved: true }) }
  useStaffAdministration.mockImplementation(() => administration)
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})
function choose(screen) { fireEvent.press(screen.getByLabelText('Manage cashier@patanos.test')) }
test('owner guidance is visible, own account has no management action', () => {
  const screen = render(<StaffAdministration />)
  expect(screen.getByText(/Create and confirm each login/)).toBeTruthy()
  expect(screen.queryByLabelText('Manage admin@patanos.test')).toBeNull()
})
test('cashier cannot see staff controls', () => {
  administration.ownerId = null
  const screen = render(<StaffAdministration />)
  expect(screen.queryByText('Staff access')).toBeNull()
})
test('approval requires reason and explicit confirmation', async () => {
  const screen = render(<StaffAdministration />)
  choose(screen)
  fireEvent.press(screen.getByLabelText('Approve / re-enable'))
  expect(Alert.alert).not.toHaveBeenCalled()
  expect(screen.getByText(/Enter a reason/)).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Reason for staff access change'), 'Known family staff')
  fireEvent.press(screen.getByLabelText('Owner: POS and admin'))
  fireEvent.press(screen.getByLabelText('Approve / re-enable'))
  expect(administration.save).not.toHaveBeenCalled()
  const [, message, buttons] = Alert.alert.mock.calls[0]
  expect(message).toMatch(/owner \(POS and administration\)/)
  await act(() => buttons[1].onPress())
  expect(administration.save).toHaveBeenCalledWith({ userId: 'cashier', enabled: true, staffRole: 'admin', reason: 'Known family staff' })
  expect(screen.getByText('Staff change confirmed by the server.')).toBeTruthy()
  expect(screen.queryByLabelText('Reason for staff access change')).toBeNull()
})
test('disable confirmation explains pending-order and offline limitations', async () => {
  administration.staff[1].is_enabled = true
  const screen = render(<StaffAdministration />)
  choose(screen)
  fireEvent.changeText(screen.getByLabelText('Reason for staff access change'), 'Account no longer used')
  fireEvent.press(screen.getByLabelText('Disable staff access'))
  const [, message, buttons] = Alert.alert.mock.calls[0]
  expect(message).toMatch(/does not erase pending orders/)
  expect(message).toMatch(/offline access/)
  await act(() => buttons[1].onPress())
  expect(administration.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
})
test('denial keeps reason, shows error, and does not claim success', async () => {
  administration.save.mockResolvedValue({ error: 'Could not confirm this change.' })
  const screen = render(<StaffAdministration />)
  choose(screen)
  fireEvent.changeText(screen.getByLabelText('Reason for staff access change'), 'Reviewed staff')
  fireEvent.press(screen.getByLabelText('Approve / re-enable'))
  await act(() => Alert.alert.mock.calls[0][2][1].onPress())
  expect(screen.getByLabelText('Reason for staff access change').props.value).toBe('Reviewed staff')
  expect(screen.getByText('Could not confirm this change.')).toBeTruthy()
  expect(screen.queryByText('Staff change confirmed by the server.')).toBeNull()
})
test.each([{ isOnline: false }, { busy: true }, { loading: true }, { error: 'Refresh required' }])('unavailable states disable staff actions: %j', state => {
  Object.assign(administration, state)
  const screen = render(<StaffAdministration />)
  fireEvent.press(screen.getByLabelText('Manage cashier@patanos.test'))
  expect(screen.queryByLabelText('Reason for staff access change')).toBeNull()
  expect(administration.save).not.toHaveBeenCalled()
})
test('empty and offline states are explained', () => {
  administration.staff = []
  const screen = render(<StaffAdministration />)
  expect(screen.getByText(/No staff accounts returned/)).toBeTruthy()
  administration.isOnline = false
  screen.rerender(<StaffAdministration />)
  expect(screen.getByText(/Offline: staff changes/)).toBeTruthy()
})
