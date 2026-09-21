import * as Solid from "@heroicons/react/24/solid";

/**
 * The server stores "__hero:<HeroiconName>" for notes the web app iconed itself,
 * and "__<app>" / "__app:<name>" for notes a tool posted. The first kind names a
 * Heroicon outright; the second is mapped here the way Noto maps it to an SF
 * Symbol. Rendered on the server, so none of the 324 icons reach the browser.
 */
const APP: Record<string, keyof typeof Solid> = {
  repoaudit: "MagnifyingGlassCircleIcon",
  praudit: "MagnifyingGlassCircleIcon",
  skillaudit: "MagnifyingGlassCircleIcon",
  epicaudit: "MagnifyingGlassCircleIcon",
  devaudit: "MagnifyingGlassCircleIcon",
  portfolioaudit: "MagnifyingGlassCircleIcon",
  githubaudit: "MagnifyingGlassCircleIcon",
  resourceaudit: "MagnifyingGlassCircleIcon",
  projectaudit: "MagnifyingGlassCircleIcon",
  reporecon: "EyeIcon",
  repotest: "CheckBadgeIcon",
  gmail: "EnvelopeIcon",
  linkedin: "UserCircleIcon",
  github: "CodeBracketIcon",
  prtrends: "ArrowTrendingUpIcon",
  githubstats: "ArrowTrendingUpIcon",
  prsummary: "ArrowTrendingUpIcon",
  "app:fable": "SparklesIcon",
  "app:worldcup26": "TrophyIcon",
  "app:skill-architect": "WrenchScrewdriverIcon",
  "app:job": "BriefcaseIcon",
  "app:jobs": "BriefcaseIcon",
  "app:incident-report": "ExclamationTriangleIcon",
  "app:countries": "GlobeAmericasIcon",
  "app:bheng": "UserCircleIcon",
  "app:rust": "CodeBracketIcon",
  "app:react": "CodeBracketIcon",
  "app:laravel": "CodeBracketIcon",
  "app:next.js": "CodeBracketIcon",
  "app:typescript": "CodeBracketIcon",
};

function resolve(token: string) {
  if (!token.startsWith("__")) return Solid.DocumentTextIcon;
  const body = token.slice(2);
  const name = body.startsWith("hero:")
    ? (body.slice(5) as keyof typeof Solid)
    : APP[body];
  return (name && Solid[name]) || Solid.DocumentTextIcon;
}

/**
 * The note's icon in `currentColor`, so the row can tint it with its folder
 * colour. Rendered once per distinct token by the layout, never per row.
 */
export default function NoteIcon({ token }: { token: string }) {
  const Icon = resolve(token);
  return <Icon className="size-[15px] shrink-0" />;
}
