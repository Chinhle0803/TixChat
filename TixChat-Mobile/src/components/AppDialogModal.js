import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

const DEFAULT_ACTIONS = [{ text: 'OK', style: 'default' }]

export default function AppDialogModal({
  visible,
  title,
  message,
  actions,
  onClose,
}) {
  const safeActions = Array.isArray(actions) && actions.length > 0 ? actions : DEFAULT_ACTIONS

  const handleActionPress = (action) => {
    onClose?.()
    if (typeof action?.onPress === 'function') {
      action.onPress()
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
          <Text style={styles.message}>{String(message || '')}</Text>

          <View style={styles.actionsRow}>
            {safeActions.map((action, index) => {
              const actionStyle = String(action?.style || 'default')
              const isDestructive = actionStyle === 'destructive'
              const isCancel = actionStyle === 'cancel'

              return (
                <Pressable
                  key={`${String(action?.text || 'action')}-${index}`}
                  style={[
                    styles.actionBtn,
                    isDestructive && styles.actionBtnDestructive,
                    isCancel && styles.actionBtnCancel,
                  ]}
                  onPress={() => handleActionPress(action)}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      isDestructive && styles.actionBtnTextDestructive,
                      isCancel && styles.actionBtnTextCancel,
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    marginTop: 8,
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  actionsRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    borderRadius: 10,
    backgroundColor: '#1061e8',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionBtnCancel: {
    backgroundColor: '#e2e8f0',
  },
  actionBtnDestructive: {
    backgroundColor: '#dc2626',
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  actionBtnTextCancel: {
    color: '#1e293b',
  },
  actionBtnTextDestructive: {
    color: '#ffffff',
  },
})
