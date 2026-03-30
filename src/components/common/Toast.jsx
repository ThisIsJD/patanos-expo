import React, { useEffect, useRef } from 'react'
import { Text, StyleSheet, Animated } from 'react-native'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'

export default function Toast({ message, visible, onHide, type = 'info' }) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
      const timer = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(onHide)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!visible) return null

  const bgColor = type === 'error' ? COLORS.error
    : type === 'success' ? COLORS.success
    : COLORS.bgElevated

  return (
    <Animated.View style={[styles.toast, { opacity, backgroundColor: bgColor }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    left: SPACING.lg,
    right: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    zIndex: 999,
  },
  text: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
})
