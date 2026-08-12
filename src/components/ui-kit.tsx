import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
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

import {
  AppColors,
  AppRadius,
  AppShadow,
  AppSpacing,
} from '@/constants/app-theme';

export function getChoiceChipPalette(selected: boolean, milestone: boolean) {
  if (!selected) {
    return { background: AppColors.surface, text: AppColors.textMuted };
  }

  return milestone
    ? { background: AppColors.accent, text: AppColors.text }
    : { background: AppColors.primary, text: AppColors.white };
}

export function getChoiceChipLabel(label: string, selected: boolean) {
  return selected ? `✓ ${label}` : label;
}

export function getPressDepth(pressed: boolean) {
  return [{ translateY: pressed ? 2 : 0 }];
}

export function getPlasticShadow(pressed: boolean) {
  if (!pressed) {
    return AppShadow.raised;
  }

  return {
    ...AppShadow.raised,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  };
}

type StatusBadgeTone = 'neutral' | 'success' | 'warning' | 'accent';

export function getStatusBadgePalette(tone: StatusBadgeTone) {
  switch (tone) {
    case 'warning':
      return { background: AppColors.primarySoft, text: AppColors.text };
    case 'accent':
      return { background: AppColors.surface, text: AppColors.primary };
    case 'neutral':
    case 'success':
      return { background: AppColors.primary, text: AppColors.white };
  }
}

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

export function LoadingScreen({ label = '正在清点你的家…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={AppColors.primary} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
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
      {action ? <View style={styles.headerAction}>{action}</View> : null}
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
        {
          ...getPlasticShadow(pressed && !disabled),
          transform: getPressDepth(pressed && !disabled),
        },
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
      style={({ pressed }) => [
        styles.addButton,
        {
          ...getPlasticShadow(pressed),
          transform: getPressDepth(pressed),
        },
      ]}>
      <Text style={styles.addButtonIcon}>＋</Text>
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: StatusBadgeTone;
}) {
  const palette = getStatusBadgePalette(tone);

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>
        {label}
      </Text>
    </View>
  );
}

export function ChoiceChip({
  label,
  selected,
  onPress,
  milestone = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  milestone?: boolean;
}) {
  const palette = getChoiceChipPalette(selected, milestone);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        { backgroundColor: palette.background },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.chipText, { color: palette.text }]}>
        {getChoiceChipLabel(label, selected)}
      </Text>
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
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              hitSlop={12}
              style={styles.closeButtonTarget}>
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
    paddingHorizontal: 20,
    paddingTop: AppSpacing.md,
    paddingBottom: 120,
    gap: AppSpacing.xl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.md,
    backgroundColor: AppColors.background,
  },
  loadingText: {
    color: AppColors.textMuted,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AppSpacing.md,
  },
  headerText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: AppSpacing.xs,
  },
  headerAction: {
    flexShrink: 0,
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
    borderRadius: AppRadius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: AppSpacing.lg,
    ...AppShadow.ceramic,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: AppRadius.control,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: AppColors.primaryBright,
    borderTopColor: AppColors.white,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.lg,
    ...AppShadow.raised,
  },
  primaryButtonCompact: {
    minHeight: 44,
    borderRadius: AppRadius.control,
    paddingHorizontal: AppSpacing.md,
  },
  primaryButtonText: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  textButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.sm,
  },
  textButtonLabel: {
    color: AppColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  textButtonDanger: {
    color: AppColors.danger,
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: AppColors.primaryBright,
    borderTopColor: AppColors.white,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...AppShadow.raised,
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
    backgroundColor: AppColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: AppColors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  chip: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: AppRadius.pill,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
  },
  chipSelected: {
    borderColor: AppColors.primary,
  },
  chipText: {
    color: AppColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: AppSpacing.xxl,
    gap: AppSpacing.sm,
  },
  emptyIcon: {
    fontSize: 34,
  },
  emptyTitle: {
    alignSelf: 'stretch',
    color: AppColors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    alignSelf: 'stretch',
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
  closeButtonTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: AppSpacing.lg,
    paddingBottom: 60,
    gap: AppSpacing.lg,
  },
});
