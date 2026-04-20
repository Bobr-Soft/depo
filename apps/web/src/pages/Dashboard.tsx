import * as React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { createTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import {  useDemoRouter } from '@toolpad/core/internal';
import {
  AppProvider,
  type Session,
  type Navigation,

} from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import Stack from '@mui/material/Stack';
import ListIcon from '@mui/icons-material/List';
import ConstructionIcon from '@mui/icons-material/Construction';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import OverviewPage from './OverviewPage';
import ManageLocationsPage from './ManageLocationsPage';
import CategoriesPage from './ManageCategoriesPage';
import ManageUsersPage from './ManageUsersPage';
import ManageItemsPage from './ManageItemsPage';
import AddIcon from '@mui/icons-material/Add';
import BugReportIcon from '@mui/icons-material/BugReport';
import ChecklistIcon from '@mui/icons-material/Checklist';
import QuickActionsPageList from './QuickActionsPageList';
import QuickActionsPageAdd from './QuickActionsPageAdd';
import RentingItemsPage from './RentingItemsPage';
import ManageRentingItemsPage from './ManageRentingItemsPage';
import DebugPage from './DebugPage';
import PickingPage from './PickingPage';
import { normalizeUserRole, type UserRole } from '../utils/roles';
const NAVIGATION: Navigation = [
  {
    segment: 'overview',
    title: 'Áttekintés',
    icon: <DashboardIcon />,
  },
  {
      segment: 'renting',
      title: 'Kölcsönzés',
      icon: <DashboardIcon />,
  },
  {    segment: 'manage-rentings',
    title: 'Kölcsönzések kezelése',
    icon: <DashboardIcon />,
  },
  
  {
    segment: 'manage-items',
    title: 'Elemek kezelése',
    icon: <ConstructionIcon />,
  },
  {
    segment: 'manage-categories',
    title: 'Kategóriák kezelése',
    icon: <ListIcon />,
  },
  {
    segment: 'manage-locations',
    title: 'Helyszínek kezelése',
    icon: <ConstructionIcon />,
  },
  {
    segment: 'manage-users',
    title: 'Felhasználók kezelése',
    icon: <SupervisorAccountIcon />,
  },
  {
    segment: 'picking',
    title: 'Picking',
    icon: <ChecklistIcon />,
  },
  {
    segment: 'debug',
    title: 'Debug',
    icon: <BugReportIcon />,
  }
];


const demoTheme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'data-toolpad-color-scheme',

  },
  colorSchemes: {
    light: {
      palette: {
        background: {
          default: '#f5f5f5',
          paper: '#ffffff',
        },
        text: {
          primary: '#000000',
        },
      },
    },
    dark: {
      palette: {
        background: {
          default: '#0d1117',
          paper: '#161b22',
        },
        text: {
          primary: '#ffffff',
        },
      },
    },
  },
});

function DemoPageContent({ pathname, role, userEmail }: { pathname: string; role: UserRole; userEmail: string }) {
  console.log('🚪 Route guard check - Path:', pathname, 'Role:', role);

  const allowedPathsByRole: Record<UserRole, string[] | null> = {
    admin: null,
    supervisor: ['/overview', '/renting', '/manage-rentings', '/dashboard', '/picking'],
    worker: ['/overview', '/renting', '/dashboard', '/picking'],
  };

  const allowedPaths = allowedPathsByRole[role];
  if (allowedPaths && !allowedPaths.includes(pathname)) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" color="error" gutterBottom>
          Hozzáférés megtagadva
        </Typography>
        <Typography variant="body1">
          Nem jogosult ehhez az oldalhoz.
        </Typography>
      </Box>
    );
  }

  switch (pathname as string) {
    case '/overview':
      return (<OverviewPage />);
    case '/dashboard':
      // Redirect to appropriate page based on role
      return (<OverviewPage />);
    case '/renting':
      return (<RentingItemsPage role={role} userEmail={userEmail} />);
    case '/manage-rentings':
      return (<ManageRentingItemsPage role={role} userEmail={userEmail} />);
    case '/manage-categories':
      return (<CategoriesPage />);
    case '/manage-items':
      return (<ManageItemsPage />);
    case '/manage-users':
      return (<ManageUsersPage />);
    case '/manage-locations':
      return (<ManageLocationsPage />);
    
    
    case '/picking':
      return (<PickingPage userRole={role} />);
    case '/debug':
      return (<DebugPage />);
    default:
      return <div>Page not found.</div>;
  }

}

interface DashboardProps {
  onLogout: () => void;
  user: {
    name: string;
    email: string;
    image?: string;
    role?: string;
  };
}
function MyAppTitle() {
    return (
    <Stack direction="row" alignItems="center" spacing={2}>
      <Typography variant="h6">Leltár App</Typography>
    </Stack>
  );
}

export default function Dashboard({ onLogout, user }: DashboardProps) {
  const router = useDemoRouter('/dashboard');
  const stabilizeMainScrollbar = router.pathname === '/manage-items';
  const [session, setSession] = React.useState<Session | null>({
    user: {
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });

  const userRoleRaw = (user.role || 'Worker').toString().trim();
  const role = normalizeUserRole(userRoleRaw);
  console.log('👤 Dashboard loaded with user:', user);
  console.log('👤 User role:', userRoleRaw, 'Type:', typeof userRoleRaw);
  console.log('👤 Normalized role:', role);

  // Filter navigation based on role
  const filteredNavigation = React.useMemo(() => {
    console.log('🔍 Filtering navigation for role:', role);

    if (role === 'admin') {
      // Admins see everything EXCEPT the worker-facing renting entry
      return NAVIGATION.filter((item) => !('segment' in item) || item.segment !== 'renting');
    }

    if (role === 'supervisor') {
      // Supervisors can approve rentings
      return NAVIGATION.filter(
        (item) => 'segment' in item && (item.segment === 'overview' || item.segment === 'manage-rentings' || item.segment === 'picking')
      );
    }

    // Workers can request rentings
    return NAVIGATION.filter(
      (item) => 'segment' in item && (item.segment === 'overview' || item.segment === 'renting' || item.segment === 'picking')
    );
  }, [role]);


  const authentication = React.useMemo(
    () => ({
      signIn: () => setSession({ user }),
      signOut: onLogout,
    }),
    [onLogout, user]
  );

  return (
    <AppProvider
      session={session}
      authentication={authentication}
      navigation={filteredNavigation}
      router={router}
      theme={demoTheme}
    >
      <DashboardLayout
        sx={
          stabilizeMainScrollbar
            ? {
                '& main': {
                  scrollbarGutter: 'stable',
                  overflowY: 'scroll !important',
                },
              }
            : undefined
        }
        slots={{
          appTitle: MyAppTitle
        }}
      >
        <DemoPageContent pathname={router.pathname} role={role} userEmail={user.email} />
      </DashboardLayout>
    </AppProvider>
  );
}
