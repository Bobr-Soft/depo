import * as React from 'react';
import Typography from '@mui/material/Typography';
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



const NAVIGATION: Navigation = [
  {
    segment: 'overview',
    title: 'Overview',
    icon: <DashboardIcon />,
  },
  {
    segment: 'manage-items',
    title: 'Manage Items',
    icon: <ConstructionIcon />,
  },
  {
    segment: 'manage-categories',
    title: 'Manage Categories',
    icon: <ListIcon />,
  },
  {
    segment: 'manage-locations',
    title: 'Manage Locations',
    icon: <ConstructionIcon />,
  },
  {
    segment: 'manage-users',
    title: 'Manage Users',
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

function DemoPageContent({ pathname }: { pathname: string }) {
   switch (pathname) {
    case '/overview':
      return (<OverviewPage />);
    case '/dashboard':
      return (<OverviewPage />);
    case '/manage-categories':
      return (<CategoriesPage />);
    case '/manage-items':
      return (<ManageItemsPage />);
    case '/manage-users':
      return (<ManageUsersPage />);
    case '/manage-locations':
      return (<ManageLocationsPage />);
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
      navigation={NAVIGATION}
      router={router}
      theme={demoTheme}
    >
      <DashboardLayout
        slots={{
          appTitle: MyAppTitle
        }}


      >
        <DemoPageContent pathname={router.pathname} />
      </DashboardLayout>
      
    </AppProvider>
  );
}
