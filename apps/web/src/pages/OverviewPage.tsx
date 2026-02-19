import { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Category as CategoryIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../services/api';

interface Item {
  id: number;
  name: string;
  quantity: number;
  category: string;
  location: string;
}

interface Stats {
  totalItems: number;
  totalCategories: number;
  totalLocations: number;
  totalUsers: number;
  lowStockItems: number;
  totalQuantity: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalItems: 0,
    totalCategories: 0,
    totalLocations: 0,
    totalUsers: 0,
    lowStockItems: 0,
    totalQuantity: 0,
  });
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<{id: number; name: string}[]>([]);
  const [locations, setLocations] = useState<{id: number; name: string}[]>([]);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, categoriesRes, locationsRes, usersRes] = await Promise.all([
        api.get('/items'),
        api.get('/categories'),
        api.get('/locations'),
        api.get('/users'),
      ]);

      const itemsData = itemsRes.data;
      const categoriesData = categoriesRes.data;
      const locationsData = locationsRes.data;
      const usersData = usersRes.data;

      setItems(itemsData);
      setCategories(categoriesData);
      setLocations(locationsData);

      const lowStock = itemsData.filter((item: Item) => item.quantity < 10).length;
      const totalQty = itemsData.reduce((sum: number, item: Item) => sum + item.quantity, 0);

      setStats({
        totalItems: itemsData.length,
        totalCategories: categoriesData.length,
        totalLocations: locationsData.length,
        totalUsers: usersData.length,
        lowStockItems: lowStock,
        totalQuantity: totalQty,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  // Prepare chart data
  const categoryData = categories.map(cat => ({
    name: cat.name,
    count: items.filter(item => item.category === cat.name).length,
  })).filter(item => item.count > 0);

  const locationData = locations.map(loc => ({
    name: loc.name,
    count: items.filter(item => item.location === loc.name).length,
  })).filter(item => item.count > 0);

  const topItems = [...items]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map(item => ({
      name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
      quantity: item.quantity,
    }));

  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        Áttekintés
      </Typography>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)', lg: '1 1 calc(16.666% - 20px)' } }}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 2.5, 
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Összes Termék
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="text.primary">
                  {stats.totalItems}
                </Typography>
              </Box>
              <InventoryIcon sx={{ fontSize: 42, color: '#667eea', opacity: 0.8 }} />
            </Box>
          </Paper>
        </Box>

        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)', lg: '1 1 calc(16.666% - 20px)' } }}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 2.5, 
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Kategóriák
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="text.primary">
                  {stats.totalCategories}
                </Typography>
              </Box>
              <CategoryIcon sx={{ fontSize: 42, color: '#f093fb', opacity: 0.8 }} />
            </Box>
          </Paper>
        </Box>

        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)', lg: '1 1 calc(16.666% - 20px)' } }}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 2.5, 
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Helyszínek
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="text.primary">
                  {stats.totalLocations}
                </Typography>
              </Box>
              <LocationIcon sx={{ fontSize: 42, color: '#4facfe', opacity: 0.8 }} />
            </Box>
          </Paper>
        </Box>

        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)', lg: '1 1 calc(16.666% - 20px)' } }}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 2.5, 
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Felhasználók
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="text.primary">
                  {stats.totalUsers}
                </Typography>
              </Box>
              <PeopleIcon sx={{ fontSize: 42, color: '#43e97b', opacity: 0.8 }} />
            </Box>
          </Paper>
        </Box>

        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)', lg: '1 1 calc(16.666% - 20px)' } }}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 2.5, 
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Készlet Összesen
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="text.primary">
                  {stats.totalQuantity}
                </Typography>
              </Box>
              <TrendingUpIcon sx={{ fontSize: 42, color: '#ffa726', opacity: 0.8 }} />
            </Box>
          </Paper>
        </Box>

        <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)', lg: '1 1 calc(16.666% - 20px)' } }}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 2.5, 
              height: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Alacsony Készlet
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="text.primary">
                  {stats.lowStockItems}
                </Typography>
              </Box>
              <WarningIcon sx={{ fontSize: 42, color: '#ef5350', opacity: 0.8 }} />
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Charts */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {/* Items by Category */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
          <Paper elevation={2} sx={{ p: 3, height: 420 }}>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
              Termékek Kategóriánként
            </Typography>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent = 0 }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={isMobile ? 80 : 100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {categoryData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%' }}>
                <Typography color="text.secondary">Nincs elérhető adat</Typography>
              </Box>
            )}
          </Paper>
        </Box>

        {/* Items by Location */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
          <Paper elevation={2} sx={{ p: 3, height: 420 }}>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
              Termékek Helyszínenként
            </Typography>
            {locationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={locationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#667eea" name="Termékek" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%' }}>
                <Typography color="text.secondary">Nincs elérhető adat</Typography>
              </Box>
            )}
          </Paper>
        </Box>

        {/* Top 5 Items by Quantity */}
        <Box sx={{ flex: '1 1 100%' }}>
          <Paper elevation={2} sx={{ p: 3, height: 420 }}>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
              Top 5 Termék Készlet Szerint
            </Typography>
            {topItems.length > 0 ? (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={topItems} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={isMobile ? 80 : 150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantity" fill="#43e97b" name="Mennyiség" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%' }}>
                <Typography color="text.secondary">Nincs elérhető adat</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>
    </Container>
  );
}
