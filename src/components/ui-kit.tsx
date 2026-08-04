import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, AppRadius, AppSpacing } from '@/constants/app-theme';

export function Screen({
  children,
  scroll = true,
}: PropsWithChildren<{ scroll?: boolean }>) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.screenContent}>{children}</View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {content}
    </SafeAreaView>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionTitle({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        compact && styles.primaryButtonCompact,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
      <Text style={[styles.textButtonLabel, tone === 'danger' && styles.textButtonDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
      <Text style={styles.addButtonIcon}>＋</Text>
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'accent';
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'success' && styles.badgeSuccess,
        tone === 'warning' && styles.badgeWarning,
        tone === 'accent' && styles.badgeAccent,
      ]}>
      <Text
        style={[
          styles.badgeText,
          tone === 'success' && styles.badgeSuccessText,
          tone === 'warning' && styles.badgeWarningText,
          tone === 'accent' && styles.badgeAccentText,
        ]}>
        {label}
      </Text>
    </View>
  );
}

export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Card style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </Card>
  );
}

export function ModalSheet({
  visible,
  title,
  children,
  onClose,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeButton}>完成</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: AppSpacing.lg,
    paddingTop: AppSpacing.md,
    paddingBottom: 120,
    gap: AppSpacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AppSpacing.md,
  },
  headerText: {
    flex: 1,
    gap: AppSpacing.xs,
  },
  eyebrow: {
    color: AppColors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  pageTitle: {
    color: AppColors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  description: {
    color: AppColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: AppSpacing.md,
  },
  sectionTitle: {
    color: AppColors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  sectionDetail: {
    color: AppColors.textMuted,
    fontSize: 13,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: AppRadius.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.border,
    padding: AppSpacing.lg,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: AppRadius.md,
    borderCurve: 'continuous',
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.lg,
  },
  primaryButtonCompact: {
    minHeight: 36,
    borderRadius: AppRadius.sm,
    paddingHorizontal: AppSpacing.md,
  },
  primaryButtonText: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  textButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.sm,
  },
  textButtonLabel: {
    color: AppColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  textButtonDanger: {
    color: '#B4483D',
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIcon: {
    color: AppColors.white,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 31,
  },
  pressed: {
    opacity: 0.72,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: AppRadius.pill,
    backgroundColor: AppColors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: AppColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeSuccess: {
    backgroundColor: AppColors.primarySoft,
  },
  badgeSuccessText: {
    color: AppColors.success,
  },
  badgeWarning: {
    backgroundColor: '#F8E9D6',
  },
  badgeWarningText: {
    color: AppColors.warning,
  },
  badgeAccent: {
    backgroundColor: AppColors.accentSoft,
  },
  badgeAccentText: {
    color: AppColors.accent,
  },
  chip: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: AppRadius.pill,
    backgroundColor: AppColors.surface,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 9,
  },
  chipSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primarySoft,
  },
  chipText: {
    color: AppColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: AppColors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: AppSpacing.xxl,
    gap: AppSpacing.sm,
  },
  emptyIcon: {
    fontSize: 34,
  },
  emptyTitle: {
    color: AppColors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyDescription: {
    color: AppColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.border,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.lg,
  },
  modalTitle: {
    color: AppColors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalContent: {
    padding: AppSpacing.lg,
    paddingBottom: 60,
    gap: AppSpacing.lg,
  },
});
