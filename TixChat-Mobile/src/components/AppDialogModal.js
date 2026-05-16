import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAppTheme } from '../theme'

const DEFAULT_ACTIONS = [{ text: 'OK', style: 'default' }]

export default function AppDialogModal({
  visible,
  title,
  message,
  actions,
  inputProps,
  isPrompt,
  onClose,
}) {
  const theme = useAppTheme()
  const c = theme.colors
  const styles = useMemo(() => createStyles(theme), [theme])
  const safeActions = Array.isArray(actions) && actions.length > 0 ? actions : DEFAULT_ACTIONS
  const [promptValue, setPromptValue] = useState(String(inputProps?.defaultValue || ''))

  useEffect(() => {
    if (visible) {
      setPromptValue(String(inputProps?.defaultValue || ''))
    }
  }, [inputProps?.defaultValue, visible])

  const handleActionPress = (action) => {
    onClose?.()
    if (typeof action?.onPress === 'function') {
      action.onPress(isPrompt ? promptValue : undefined)
    }
  }

  return (
    <Modal
      transparent
      visible={Boolean(visible)}
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{String(title || 'Thông báo')}</Text>
          {!!message && <Text style={styles.message}>{String(message || '')}</Text>}

          {isPrompt ? (
            <TextInput
              value={promptValue}
              onChangeText={setPromptValue}
              placeholder={String(inputProps?.placeholder || '')}
              placeholderTextColor={c.neutral500}
              style={styles.input}
              autoFocus
            />
          ) : null}

          <View style={styles.actionsRow}>
            {safeActions.map((action, index) => {
              const actionStyle = String(action?.style || 'default')
              const isCancel = actionStyle === 'cancel' || actionStyle === 'ghost'
              const isDestructive = actionStyle === 'danger' || actionStyle === 'destructive'

              return (
                <Pressable
                  key={`${String(action?.text || 'action')}-${index}`}
                  style={[
                    styles.actionBtn,
                    isCancel && styles.actionBtnCancel,
                    isDestructive && styles.actionBtnDestructive,
                  ]}
                  onPress={() => handleActionPress(action)}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      isCancel && styles.actionBtnTextCancel,
                      isDestructive && styles.actionBtnTextDestructive,
                    ]}
                  >
                    {String(action?.text || 'OK')}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const createStyles = (theme) => {
  const c = theme.colors

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.isDark ? 'rgba(2, 6, 23, 0.78)' : 'rgba(2, 6, 23, 0.62)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      borderRadius: theme.radius.xl,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[4],
      ...theme.shadows.md,
    },
    title: {
      color: c.neutral900,
      fontSize: theme.type.lg,
      fontWeight: '700',
    },
    message: {
      marginTop: theme.spacing[2],
      color: c.neutral700,
      fontSize: theme.type.sm,
      lineHeight: 20,
    },
    input: {
      minHeight: 44,
      marginTop: theme.spacing[3],
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: c.input,
      backgroundColor: c.surface,
      color: c.neutral900,
      paddingHorizontal: theme.spacing[3],
      fontSize: theme.type.base,
    },
    actionsRow: {
      marginTop: theme.spacing[4],
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: theme.spacing[2],
    },
    actionBtn: {
      borderRadius: theme.radius.md,
      backgroundColor: c.primary,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    actionBtnCancel: {
      backgroundColor: c.muted,
      borderWidth: 1,
      borderColor: c.border,
    },
    actionBtnDestructive: {
      backgroundColor: c.danger,
    },
    actionBtnText: {
      color: c.primaryForeground,
      fontWeight: '700',
    },
    actionBtnTextCancel: {
      color: c.neutral700,
    },
    actionBtnTextDestructive: {
      color: '#FFFFFF',
    },
  })
}
