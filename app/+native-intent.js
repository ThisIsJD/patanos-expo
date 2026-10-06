import { isRecoveryPath } from '@/src/utils/recoveryLinks'

export function redirectSystemPath({ path }) {
  // Verification consumes the original native event separately. Never put its code in route history.
  return isRecoveryPath(path) ? '/reset-password' : path
}
