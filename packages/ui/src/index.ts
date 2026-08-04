// ============================================================
// @hikaru/ui — HIKARUデザインシステム エクスポート
// ============================================================

// ---- Utility ----
export { cn } from './lib/utils'

// ---- Primitives ----
export { Button, buttonVariants, type ButtonProps } from './components/button'
export { Input, type InputProps } from './components/input'
export { Textarea, type TextareaProps } from './components/textarea'
export {
  Select, SelectGroup, SelectValue, SelectTrigger,
  SelectContent, SelectLabel, SelectItem, SelectSeparator,
  SelectScrollUpButton, SelectScrollDownButton,
} from './components/select'
export { Checkbox } from './components/checkbox'
export { RadioGroup, RadioGroupItem } from './components/radio-group'
export { Switch } from './components/switch'
export { Separator } from './components/separator'

// ---- Layout / Container ----
export {
  Card, CardHeader, CardTitle, CardDescription,
  CardContent, CardFooter, CardDivider,
} from './components/card'

// ---- Display ----
export { Badge, badgeVariants, type BadgeProps } from './components/badge'
export { Avatar, AvatarImage, AvatarFallback } from './components/avatar'

// ---- Navigation ----
export { Tabs, TabsList, TabsTrigger, TabsContent, UnderlineTabsList, UnderlineTabsTrigger } from './components/tabs'
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './components/accordion'
export { Breadcrumb, type BreadcrumbItem } from './components/breadcrumb'
export { Pagination } from './components/pagination'

// ---- Overlay ----
export {
  Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogBody, DialogFooter,
} from './components/dialog'
export { Drawer } from './components/drawer'
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/tooltip'
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuPortal, DropdownMenuSub, DropdownMenuRadioGroup,
  DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from './components/dropdown-menu'

// ---- Feedback ----
export { Alert, alertVariants, type AlertProps } from './components/alert'
export { Spinner, FullPageLoading, InlineLoading, LoadingOverlay, AILoader } from './components/loading'
export { Skeleton, SkeletonText, SkeletonCard } from './components/skeleton'
export { Toaster, toast } from './components/toast'

// ---- HIKARU HUD System ----
export { HudBackground } from './components/hud-background'
export { AIScanner, AIThinking, AIHologram } from './components/ai-scanner'
// R3FBackground は Three.js を含む重量級コンポーネントのため
// 直接インポートして使用: import { R3FBackground } from '@hikaru/ui/src/components/r3f-background'

// ---- Data ----
export {
  TableWrapper, Table, TableHeader, TableBody, TableFooter,
  TableRow, TableHead, TableCell, TableCaption,
} from './components/table'

// ---- HIKARU Business Components ----
export {
  ScoreBadge, ScoreDisplay, getScoreVariant, type ScoreVariant,
} from './components/score-badge'
export {
  StatusBadge, type JobStatus, type ProjectStatus,
} from './components/status-badge'
export { PageHeader, SectionHeader } from './components/page-header'
export { SearchBar } from './components/search-bar'
