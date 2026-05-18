import React, { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertButton,
  AlertOptions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCircleExclamation, faCircleInfo, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

const PRIMARY = '#6b7f99';
const DESTRUCTIVE = '#d32f2f';
const WARNING = '#e09b3a';

interface QueuedAlert {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
}

const nativeAlert = Alert.alert.bind(Alert);

function normalizeButtons(buttons?: AlertButton[]): AlertButton[] {
  if (!buttons || buttons.length === 0) {
    return [{ text: 'OK' }];
  }
  return buttons;
}

function getTone(title: string, buttons: AlertButton[]) {
  const lowerTitle = title.toLowerCase();
  if (buttons.some(button => button.style === 'destructive') || lowerTitle.includes('delete') || lowerTitle.includes('remove')) {
    return 'danger';
  }
  if (lowerTitle.includes('error') || lowerTitle.includes('failed')) {
    return 'warning';
  }
  return 'info';
}

export default function AppAlertProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [currentAlert, setCurrentAlert] = useState<QueuedAlert | null>(null);
  const queueRef = useRef<QueuedAlert[]>([]);
  const currentAlertRef = useRef<QueuedAlert | null>(null);

  useEffect(() => {
    currentAlertRef.current = currentAlert;
  }, [currentAlert]);

  const showNextAlert = useCallback(() => {
    const nextAlert = queueRef.current.shift() ?? null;
    setCurrentAlert(nextAlert);
  }, []);

  const closeAlert = useCallback((button?: AlertButton) => {
    const alertToClose = currentAlertRef.current;
    setCurrentAlert(null);

    setTimeout(() => {
      button?.onPress?.();
      if (!button && alertToClose?.options?.onDismiss) {
        alertToClose.options.onDismiss();
      }
      showNextAlert();
    }, 120);
  }, [showNextAlert]);

  const enqueueAlert = useCallback((title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    const alertData: QueuedAlert = {
      title,
      message,
      buttons: normalizeButtons(buttons),
      options,
    };

    if (currentAlertRef.current) {
      queueRef.current.push(alertData);
      return;
    }

    setCurrentAlert(alertData);
  }, []);

  useEffect(() => {
    Alert.alert = ((title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
      enqueueAlert(title, message, buttons, options);
    }) as typeof Alert.alert;

    return () => {
      Alert.alert = nativeAlert;
    };
  }, [enqueueAlert]);

  const colors = useMemo(() => {
    const tone = currentAlert ? getTone(currentAlert.title, currentAlert.buttons) : 'info';
    const toneColor = tone === 'danger' ? DESTRUCTIVE : tone === 'warning' ? WARNING : PRIMARY;
    return {
      tone,
      toneColor,
      backdrop: 'rgba(0,0,0,0.42)',
      cardBg: isDark ? '#1c1c1e' : '#ffffff',
      rowBg: isDark ? '#2c2c2e' : '#f8f9fa',
      border: isDark ? '#343437' : '#e7ebef',
      text: isDark ? '#ffffff' : '#111827',
      subtle: isDark ? '#9ca3af' : '#8c99a8',
    };
  }, [currentAlert, isDark]);

  const icon = colors.tone === 'danger'
    ? faTriangleExclamation
    : colors.tone === 'warning'
    ? faCircleExclamation
    : faCircleInfo;

  const canDismiss = currentAlert?.options?.cancelable !== false;

  return (
    <>
      {children}
      <Modal visible={currentAlert !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => canDismiss && closeAlert()}>
        <TouchableWithoutFeedback onPress={() => canDismiss && closeAlert()}>
          <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={[styles.iconWrap, { backgroundColor: `${colors.toneColor}18` }]}>
                  <FontAwesomeIcon icon={icon} size={22} color={colors.toneColor} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>{currentAlert?.title}</Text>
                {!!currentAlert?.message && (
                  <Text style={[styles.message, { color: colors.subtle }]}>{currentAlert.message}</Text>
                )}
                <View style={styles.actions}>
                  {currentAlert?.buttons.map((button, index) => {
                    const isCancel = button.style === 'cancel';
                    const isDestructive = button.style === 'destructive';
                    const isPrimary = !isCancel && !isDestructive && index === currentAlert.buttons.length - 1;
                    const actionColor = isDestructive ? DESTRUCTIVE : isPrimary ? PRIMARY : colors.subtle;
                    return (
                      <TouchableOpacity
                        key={`${button.text ?? 'OK'}-${index}`}
                        style={[
                          styles.actionButton,
                          {
                            backgroundColor: isPrimary || isDestructive ? `${actionColor}18` : colors.rowBg,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => closeAlert(button)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.actionText, { color: actionColor }]}>
                          {button.text ?? 'OK'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  actionButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
