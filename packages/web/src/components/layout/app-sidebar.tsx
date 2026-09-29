import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Home, FileText, Sparkles, Settings, LogOut,
  BookOpen, BookMarked, Library, ChevronUp, ChevronDown, User2, Bell, Users, CreditCard, Database, GraduationCap, BarChart3, Book, MessageSquareQuote, Bot, BookOpenText, FolderKanban, Gauge, ScrollText, NotebookPen, Zap, Download, Mail, Globe, Presentation, ShieldCheck, Coins, FileScan } from 'lucide-react';
import { useFirebase } from '@/context/firebase-context';
import { authService } from '../../../../application/src/services/AuthService';
import { toast } from 'sonner';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@dosfilos/infrastructure';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggleMenu } from '@/components/theme-toggle';
import { useTranslation } from '@/i18n';
import { doc, getDoc } from 'firebase/firestore';
import { useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';
import { getPlanLabel } from '@/utils/planLabels';
import packageJson from '../../../package.json';

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useFirebase();
  const { t } = useTranslation('navigation');
  const { subscription } = useSubscription();
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  // Admin section starts collapsed by default — it's the lowest-frequency
  // section and was the main culprit of the sidebar overflow. The
  // preference persists per-browser via localStorage so the pastor
  // doesn't re-collapse on every session.
  const [adminOpen, setAdminOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('sidebar.adminOpen') === '1';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sidebar.adminOpen', adminOpen ? '1' : '0');
  }, [adminOpen]);

  // Plan info for the footer row. Free shows a muted chip with an Upgrade CTA;
  // paid tiers show a colored chip without CTA (status, not pitch).
  const planInfo = (() => {
    const planId = subscription?.planId || 'free';
    const planClasses: Record<string, string> = {
      free: 'bg-muted text-muted-foreground border-border',
      basic: 'bg-info-subtle text-info-subtle-foreground border-info/30',
      pro: 'bg-primary/10 text-primary border-primary/30',
      team: 'bg-warning-subtle text-warning-subtle-foreground border-warning/30',
      enterprise: 'bg-warning-subtle text-warning-subtle-foreground border-warning/30',
    };
    return {
      id: planId,
      name: getPlanLabel(planId),
      className: planClasses[planId] ?? planClasses.free,
      isFree: planId === 'free',
    };
  })();

  // Check if user is super admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsAdmin(userData.role === 'super_admin');
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      }
    };

    checkAdminRole();
  }, [user]);

  // Sidebar groups follow the user's mental model — three jobs (learn / build /
  // store) plus account. Within each group items are ordered by expected use
  // frequency (Bible most-read first, Projects most-used workspace first, etc).
  //   Mis Estudios   — input/exploration: Biblia, Tutores, Griego, Hebreo
  //   Mis Trabajos   — output/production: Proyectos, Exégesis, Planificador
  //   Mis Recursos   — owned assets:      Mis Recursos (Faculty saves), Sermones, Biblioteca
  //   Cuenta         — settings
  const navigationGroups: Array<{ label?: string; tourClass?: string; items: Array<{ name: string; href: string; icon: any }> }> = [
    {
      // Dashboard — no label, sits at the very top
      items: [
        { name: t('menu.dashboard'), href: '/dashboard', icon: Home },
      ],
    },
    {
      label: t('groups.study'),
      tourClass: 'tour-target-study',
      items: [
        { name: t('menu.bible'), href: '/dashboard/bible', icon: Book },
        { name: t('menu.faculty'), href: '/dashboard/faculty', icon: MessageSquareQuote },
        { name: t('menu.greekTutor'), href: '/dashboard/greek-tutor', icon: GraduationCap },
        { name: t('menu.hebrewTutor'), href: '/dashboard/hebrew-tutor', icon: BookOpen },
      ],
    },
    {
      label: t('groups.work'),
      tourClass: 'tour-target-work',
      items: [
        { name: t('menu.projects'), href: '/dashboard/projects', icon: FolderKanban },
        { name: t('menu.exegesis'), href: '/dashboard/exegesis', icon: NotebookPen },
        { name: t('menu.plans'), href: '/dashboard/plans', icon: BookMarked },
      ],
    },
    {
      label: t('groups.resources'),
      tourClass: 'tour-target-resources',
      items: [
        // Faculty extractions library — saved chat responses, cross-session.
        { name: t('menu.facultyLibrary'), href: '/dashboard/faculty/library', icon: Sparkles },
        // Sermones lives here (not in Trabajos) — surface is mostly read/archive
        // browsing; new sermons are born inside Proyectos or Planificador.
        { name: t('menu.sermons'), href: '/dashboard/sermons', icon: FileText },
        // Biblioteca personal — tenant-isolated per userId. Material upload is
        // the user's responsibility per TOS.
        { name: t('menu.library'), href: '/dashboard/library', icon: Library },
      ],
    },
    {
      // Account: Configuración hosts Integraciones + Suscripción as tabs to
      // keep this group at one entry.
      label: t('groups.account'),
      items: [
        { name: t('menu.settings'), href: '/dashboard/settings', icon: Settings },
        { name: t('menu.confessionalWitnesses'), href: '/dashboard/settings/confession', icon: BookOpen },
      ],
    },
  ];

  const adminNavigation = [
    { name: t('menu.generateSermon'), href: '/dashboard/generate-sermon', icon: Sparkles },
    { name: 'Suite de Enseñanza', href: '/dashboard/teaching-suite', icon: Presentation },
    { name: 'Analytics', href: '/dashboard/admin/analytics', icon: BarChart3 },
    { name: 'Gestión de Usuarios', href: '/dashboard/admin/users', icon: Users },
    { name: 'Tutores', href: '/dashboard/admin/tutors', icon: Bot },
    { name: 'Pistas Hebreo', href: '/dashboard/admin/hebrew-tutor-hints', icon: BookOpen },
    { name: 'Glosario Léxico', href: '/dashboard/admin/hebrew-lexicon', icon: BookOpenText },
    { name: t('menu.contactLeads'), href: '/admin/leads', icon: Users },
    { name: 'Lead Magnets', href: '/admin/lead-magnets', icon: Download },
    { name: 'Email Previews', href: '/admin/email-previews', icon: Mail },
    { name: 'Biblioteca Core', href: '/dashboard/admin/core-library', icon: Database },
    { name: 'Catálogo CORE Confesiones', href: '/dashboard/admin/confessions', icon: ScrollText },
    { name: 'Cross-references (TSK)', href: '/dashboard/admin/cross-references', icon: Book },
    { name: 'Lecturas erróneas verificadas', href: '/dashboard/admin/verified-misreadings', icon: ShieldCheck },
    { name: 'LlamaParse Monitor', href: '/dashboard/admin/llamaparse-monitoring', icon: Gauge },
    { name: 'Sombra Doxológica', href: '/dashboard/admin/doxological-shadow', icon: Gauge },
    { name: 'Consumo de modelos', href: '/dashboard/admin/llm-cost', icon: Coins },
    { name: t('menu.extractionRuns'), href: '/dashboard/admin/extraction-runs', icon: FileScan },
    { name: 'Audit Log', href: '/dashboard/admin/audit-log', icon: ScrollText },
  ];

  // Subscribe to new leads count for admin
  useEffect(() => {
    if (!user || !isAdmin) return;

    const q = query(
      collection(db, 'contact_leads'),
      where('status', '==', 'new')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNewLeadsCount(snapshot.size);
    }, (error) => {
      console.error('Error counting new leads:', error);
    });

    return () => unsubscribe();
    // isAdmin must be in deps: when impersonating a non-admin, `user` changes
    // while `isAdmin` is still stale-true, so without re-running on the role
    // flip we'd subscribe to the admin-only `contact_leads` query as a normal
    // user and hit "insufficient permissions".
  }, [user, isAdmin]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      toast.success(t('user.sessionClosed'));
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || t('errors.logoutError'));
    }
  };

  const getUserInitials = () => {
    if (!user?.displayName) return 'U';
    return user.displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isRouteActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === href || location.pathname === `${href}/`;
    }
    if (location.pathname === href) return true;
    if (!location.pathname.startsWith(href + '/')) return false;
    // Pathname extends past `href`. Only mark active if no more
    // specific registered route ALSO matches — otherwise the parent
    // and child both light up (e.g. on `/dashboard/faculty/library`,
    // both `Tutores` (`/dashboard/faculty`) and `Mis Recursos`
    // (`/dashboard/faculty/library`) used to highlight). Most-specific
    // route wins.
    const allHrefs = [
      ...navigationGroups.flatMap((g) => g.items.map((i) => i.href)),
      ...adminNavigation.map((i) => i.href),
    ];
    const moreSpecific = allHrefs.some(
      (other) =>
        other !== href &&
        other.startsWith(href + '/') &&
        (location.pathname === other || location.pathname.startsWith(other + '/')),
    );
    return !moreSpecific;
  };

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border/50">
        <div className="flex items-center px-2 py-3 relative h-16">
          
          {/* Logo Expanded State */}
          <div className="group-data-[collapsible=icon]:hidden flex items-center justify-start h-full w-full overflow-hidden pl-4">
            <img
              src="/logo_dfp.png"
              alt="DosFilos.Preach"
              className="h-10 w-auto object-contain transition-all scale-125 mix-blend-multiply dark:mix-blend-screen dark:invert dark:grayscale dark:contrast-200"
            />
          </div>

          {/* Logo Collapsed State — uses the dedicated icon-only file
              instead of cropping the full logo. Cleaner: no transforms,
              no overflow tricks. */}
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full h-full">
            <img
              src="/logo_dfp_icon.png"
              alt="DFP"
              className="h-8 w-8 object-contain mix-blend-multiply dark:mix-blend-screen dark:invert dark:grayscale dark:contrast-200"
            />
          </div>

        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="sidebar-scrollbar">
        {navigationGroups.map((group, groupIndex) => (
          <div key={groupIndex} className={group.tourClass}>
            <SidebarGroup>
              {group.label && (
                <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = isRouteActive(item.href);
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link to={item.href}>
                            <item.icon className="h-5 w-5" />
                            <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {/* Add separator between groups (except after last group) */}
            {groupIndex < navigationGroups.length - 1 && <SidebarSeparator />}
          </div>
        ))}

        {/* Admin Section - Only visible for admin users.
            Collapsible: Admin items are the lowest-frequency section
            and the main culprit of sidebar overflow. The header is
            always visible (with chevron) so it remains discoverable;
            items render only when open. The new-leads badge bubbles
            up to the header when collapsed so urgent state stays
            visible. */}
        {isAdmin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <button
                  type="button"
                  onClick={() => setAdminOpen((v) => !v)}
                  aria-expanded={adminOpen}
                  className="group-data-[collapsible=icon]:hidden w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-warning hover:text-warning/80 transition-colors"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Admin
                    <span className="font-normal text-muted-foreground/70">
                      v{packageJson.version}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {!adminOpen && newLeadsCount > 0 && (
                      <span className="px-1.5 py-0 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-tight min-w-[18px] text-center">
                        {newLeadsCount > 99 ? '99+' : newLeadsCount}
                      </span>
                    )}
                    {adminOpen
                      ? <ChevronUp className="h-3.5 w-3.5" />
                      : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {adminOpen && (
                  <SidebarMenu>
                    {adminNavigation.map((item) => {
                      const isActive = isRouteActive(item.href);
                      const isLeadsItem = item.href === '/admin/leads';
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link to={item.href} className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <item.icon className="h-5 w-5" />
                                <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
                              </div>
                              {isLeadsItem && newLeadsCount > 0 && (
                                <span
                                  className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full group-data-[collapsible=icon]:hidden bg-rose-500 text-white min-w-[20px] text-center"
                                >
                                  {newLeadsCount > 99 ? '99+' : newLeadsCount}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Footer with User Menu */}
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 w-full px-2 py-2 hover:bg-sidebar-accent rounded-md transition-colors cursor-pointer">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left overflow-hidden flex-1 group-data-[collapsible=icon]:hidden">
                    <span className="text-sm font-medium truncate w-full leading-tight text-left">
                      {user?.displayName || t('user.defaultName')}
                    </span>
                    <span className="flex items-center justify-start gap-2 text-xs leading-tight mt-1.5">
                      <span className={`inline-flex items-center px-1.5 py-0 rounded-sm font-medium ${planInfo.className} border`}>
                        {planInfo.name}
                      </span>
                      {planInfo.isFree && (
                        <span className="text-primary font-medium">
                          {t('user.upgrade')} →
                        </span>
                      )}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-64">
                {/* Identity header — full email lives here, not in the main button */}
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.displayName || t('user.defaultName')}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Plan summary row inside the dropdown for paid users + quick Manage link */}
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/settings?tab=subscription" className="flex items-center justify-between cursor-pointer">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span className={`inline-flex items-center px-1.5 py-0 rounded-sm text-xs font-medium border ${planInfo.className}`}>
                        {planInfo.name}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {planInfo.isFree ? t('user.upgrade') : t('user.manage')} →
                    </span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  {t('user.appearance')}
                </DropdownMenuLabel>
                <ThemeToggleMenu />

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link to="/dashboard/settings" className="cursor-pointer">
                    <User2 className="mr-2 h-4 w-4" />
                    {t('user.profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell className="mr-2 h-4 w-4" />
                  {t('user.notifications')}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('user.logout')}
                </DropdownMenuItem>

                {/* Build version is support-only metadata — kept available for screenshots
                    but out of the main UI where it carried no user value */}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-[10px] text-muted-foreground/60 text-center">
                  v{packageJson.version}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
