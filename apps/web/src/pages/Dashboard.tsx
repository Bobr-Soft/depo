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
import QuickActionsPageList from './QuickActionsPageList';
import QuickActionsPageAdd from './QuickActionsPageAdd';
import RentingItemsPage from './RentingItemsPage';
import ManageRentingItemsPage from './ManageRentingItemsPage';
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
    segment: 'quick-actions',
    title: 'Gyors műveletek',
    icon: <ConstructionIcon />,
    children: [
      {
        segment: 'quick-action-item-add',
        title: 'Elem hozzáadása',
        icon: <AddIcon />,
      },
      {
        segment: 'quick-action-item-list',
        title: 'Elemek listája',
        icon: <ListIcon />,
      },
    ],
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

function DemoPageContent({ pathname, userRole }: { pathname: string; userRole: string }) {
  const isAdmin = userRole.toLowerCase() === 'admin';
  console.log('🚪 Route guard check - Path:', pathname, 'Role:', userRole, 'Is Admin:', isAdmin);
  
  // Route guard based on role
  if (isAdmin) {
    // Admin cannot access renting page
    if (pathname === '/renting') {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Hozzáférés megtagadva
          </Typography>
          <Typography variant="body1">
            Az adminisztrátorok számára a Kölcsönzések kezelése érhető el.
          </Typography>
        </Box>
      );
    }
  } else {
    // Teacher can only access overview, renting and dashboard
    const allowedPaths = ['/overview', '/renting', '/dashboard'];
    if (!allowedPaths.includes(pathname)) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Hozzáférés megtagadva
          </Typography>
          <Typography variant="body1">
            Nem jogosult ehhez az oldalhoz. Csak az Áttekintés és a Kölcsönzés elérhető tanárok számára.
          </Typography>
        </Box>
      );
    }
  }

   switch (pathname as string) {
    case '/overview':
      return (<OverviewPage />);
    case '/dashboard':
      // Redirect to appropriate page based on role
      return (<OverviewPage />);
    case '/renting':
      return (<RentingItemsPage />);
    case '/manage-rentings':
      return (<ManageRentingItemsPage />);
    case '/manage-categories':
      return (<CategoriesPage />);
    case '/manage-items':
      return (<ManageItemsPage />);
    case '/manage-users':
      return (<ManageUsersPage />);
    case '/manage-locations':
      return (<ManageLocationsPage />);
    case '/quick-actions/quick-action-item-add':
      return (<QuickActionsPageAdd />);
    case '/quick-actions/quick-action-item-list':
      return (<QuickActionsPageList />);
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
  const [session, setSession] = React.useState<Session | null>({
    user: {
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });

  const userRole = (user.role || 'Teacher').toString().trim();
  console.log('👤 Dashboard loaded with user:', user);
  console.log('👤 User role:', userRole, 'Type:', typeof userRole);
  console.log('👤 User role lowercase:', userRole.toLowerCase());
  console.log('👤 Is Admin?', userRole.toLowerCase() === 'admin');

  // Filter navigation based on role
  const filteredNavigation = React.useMemo(() => {
    console.log('🔍 Filtering navigation for role:', userRole);
    const isAdmin = userRole.toLowerCase() === 'admin';
    if (isAdmin) {
      // Admins see everything EXCEPT renting
      console.log('✅ Admin detected - showing all navigation except Renting');
      return NAVIGATION.filter(item => 
        !('segment' in item) || item.segment !== 'renting'
      );
    } else {
      // Teachers see Overview and Renting
      console.log('👨‍🏫 Teacher detected - showing Overview and Renting');
      return NAVIGATION.filter(item => 
        'segment' in item && (item.segment === 'overview' || item.segment === 'renting')
      );
    }
  }, [userRole]);


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
        slots={{
          appTitle: MyAppTitle
        }}
      >
        <DemoPageContent pathname={router.pathname} userRole={userRole} />
      </DashboardLayout>  
    </AppProvider>
  );
}
