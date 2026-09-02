import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  ChartNoAxesColumnIncreasing,
  Check,
  CircleHelp,
  ImagePlus,
  Link,
  ListChecks,
  Minus,
  Package,
  Plus,
  Search,
  Users,
  type LucideProps,
} from 'lucide-react-native';

const icons = {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  ChartNoAxesColumnIncreasing,
  Check,
  CircleHelp,
  ImagePlus,
  Link,
  ListChecks,
  Minus,
  Package,
  Plus,
  Search,
  Users,
} as const;

export type AppIconName = keyof typeof icons;

export function AppIcon({ name, ...props }: LucideProps & { name: AppIconName }) {
  const Icon = icons[name];
  return <Icon {...props} />;
}
