import { Bell, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useFirebase } from '@/context/firebase-context';
import { authService } from '../../../../application/src/services/AuthService';
import { LanguageSwitcher } from '@/i18n/components/LanguageSwitcher';
import { useTranslation } from '@/i18n';

export function Header() {
  const { user } = useFirebase();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  const handleLogout = async () => {
    try {
      await authService.logout();
      toast.success(t('header.logoutSuccess'));
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || t('error'));
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

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
      <div className="flex-1">
        <h1 className="text-lg font-semibold">
          {t('header.welcome')}{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Language Switcher */}
        <LanguageSwitcher variant="ghost" showLabel={false} />
        
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar>
                <AvatarFallback className="bg-primary-solid text-primary-foreground">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.displayName || t('header.user')}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t('header.profile')}</DropdownMenuItem>
            <DropdownMenuItem>{t('header.settings')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('header.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
