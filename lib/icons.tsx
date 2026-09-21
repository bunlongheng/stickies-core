import {
  ArchiveBoxIcon, ArrowPathIcon, ArrowTrendingUpIcon, BanknotesIcon, BoltIcon, BookOpenIcon,
  BriefcaseIcon, BugAntIcon, CalendarDaysIcon, ChartBarIcon, ChatBubbleLeftRightIcon,
  CheckBadgeIcon, CheckCircleIcon, ClipboardDocumentListIcon, CloudIcon, CodeBracketIcon,
  CpuChipIcon, CubeTransparentIcon, DevicePhoneMobileIcon, DocumentTextIcon, EnvelopeIcon,
  ExclamationTriangleIcon, EyeIcon, FilmIcon, FolderIcon, GlobeAltIcon, GlobeAmericasIcon,
  HomeIcon, IdentificationIcon, KeyIcon, LightBulbIcon, LinkIcon, MagnifyingGlassCircleIcon,
  MagnifyingGlassIcon, MusicalNoteIcon, PhotoIcon, PuzzlePieceIcon, QuestionMarkCircleIcon,
  RocketLaunchIcon, ShareIcon, SparklesIcon, StarIcon, SwatchIcon, TableCellsIcon, TrophyIcon,
  UserCircleIcon, UserGroupIcon, WrenchIcon, WrenchScrewdriverIcon,
} from "@heroicons/react/24/solid";

type Glyph = typeof DocumentTextIcon;

/**
 * The web app stores "__hero:<HeroiconName>" for a note it iconed itself and
 * "__<app>" / "__app:<name>" for a note some tool posted. The first names a
 * Heroicon outright; the second is mapped, the way Noto maps it to an SF Symbol.
 *
 * Named imports, not a namespace import: this runs in the sidebar, the tab strip
 * and the palette, all of which are client components, and `import * as` would
 * put all 324 icons in the browser bundle.
 */
const HERO: Record<string, Glyph> = {
  ArchiveBoxIcon, ArrowPathIcon, BanknotesIcon, BoltIcon, BookOpenIcon, BriefcaseIcon, BugAntIcon,
  CalendarDaysIcon, ChartBarIcon, ChatBubbleLeftRightIcon, CheckCircleIcon,
  ClipboardDocumentListIcon, CloudIcon, CodeBracketIcon, CubeTransparentIcon,
  DevicePhoneMobileIcon, DocumentTextIcon, EnvelopeIcon, FilmIcon, FolderIcon, GlobeAltIcon,
  GlobeAmericasIcon, HomeIcon, IdentificationIcon, KeyIcon, LightBulbIcon, LinkIcon,
  MagnifyingGlassIcon, MusicalNoteIcon, PhotoIcon, PuzzlePieceIcon, QuestionMarkCircleIcon,
  RocketLaunchIcon, ShareIcon, SparklesIcon, StarIcon, SwatchIcon, TableCellsIcon, UserGroupIcon,
  WrenchIcon,
  // The web app's own token for an AI note; Heroicons has no robot.
  RobotIcon: CpuChipIcon,
};

const APP: Record<string, Glyph> = {
  repoaudit: MagnifyingGlassCircleIcon,
  praudit: MagnifyingGlassCircleIcon,
  skillaudit: MagnifyingGlassCircleIcon,
  epicaudit: MagnifyingGlassCircleIcon,
  devaudit: MagnifyingGlassCircleIcon,
  portfolioaudit: MagnifyingGlassCircleIcon,
  githubaudit: MagnifyingGlassCircleIcon,
  resourceaudit: MagnifyingGlassCircleIcon,
  projectaudit: MagnifyingGlassCircleIcon,
  reporecon: EyeIcon,
  repotest: CheckBadgeIcon,
  gmail: EnvelopeIcon,
  linkedin: UserCircleIcon,
  github: CodeBracketIcon,
  prtrends: ArrowTrendingUpIcon,
  githubstats: ArrowTrendingUpIcon,
  prsummary: ArrowTrendingUpIcon,
  "app:fable": SparklesIcon,
  "app:worldcup26": TrophyIcon,
  "app:skill-architect": WrenchScrewdriverIcon,
  "app:job": BriefcaseIcon,
  "app:jobs": BriefcaseIcon,
  "app:incident-report": ExclamationTriangleIcon,
  "app:countries": GlobeAmericasIcon,
  "app:bheng": UserCircleIcon,
  "app:rust": CodeBracketIcon,
  "app:react": CodeBracketIcon,
  "app:laravel": CodeBracketIcon,
  "app:next.js": CodeBracketIcon,
  "app:typescript": CodeBracketIcon,
};

export function glyphFor(token: string | null | undefined): Glyph {
  if (!token?.startsWith("__")) return DocumentTextIcon;
  const body = token.slice(2);
  return (body.startsWith("hero:") ? HERO[body.slice(5)] : APP[body]) ?? DocumentTextIcon;
}

/** A note's icon in `currentColor`, so the caller tints it with the folder colour. */
export function NoteGlyph({ token, className }: { token: string | null; className?: string }) {
  const Icon = glyphFor(token);
  return <Icon className={className ?? "size-[15px] shrink-0"} />;
}
