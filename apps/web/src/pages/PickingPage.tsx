import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { AlertTriangle, CheckCircle, Minus, Package, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../services/api';

type CatalogItem = {
  id: number;
  name: string;
  code: string;
  barcode: string;
  category: string;
  stock: number;
};

type Priority = 'normal' | 'urgent';
type RequestStatus = 'pending' | 'picking' | 'transit' | 'delivered';

type ActiveRequest = {
  id: string;
  line: string;
  status: RequestStatus;
  totalItems: number;
  createdAt: string | Date;
  priority: Priority;
};

type ApiItem = {
  id: number;
  name: string;
  barcode?: string | null;
  quantity?: number;
  category?: string | null;
};

const statusMeta: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: 'Függőben', color: '#facc15' },
  picking: { label: 'Komissiózás alatt', color: '#3b82f6' },
  transit: { label: 'Úton', color: '#f97316' },
  delivered: { label: 'Teljesítve', color: '#22c55e' },
};

export default function PickingPage() {
  const theme = useTheme();
  const [line, setLine] = useState('SMT-01');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Összes');
  const [priority, setPriority] = useState<Priority>('normal');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [activeRequests, setActiveRequests] = useState<ActiveRequest[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isRequestsLoading, setIsRequestsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(catalog.map((item) => item.category).filter((value) => Boolean(value)))
    );
    return ['Összes', ...unique];
  }, [catalog]);

  useEffect(() => {
    let cancelled = false;

    const fetchCatalog = async () => {
      setIsCatalogLoading(true);
      try {
        const response = await api.get('/items');
        if (cancelled) {
          return;
        }

        const mapped = (Array.isArray(response.data) ? response.data : []).map((item: ApiItem) => ({
          id: item.id,
          name: item.name,
          code: item.barcode || `ITEM-${item.id}`,
          barcode: item.barcode || '',
          category: item.category || 'Egyéb',
          stock: Math.max(0, Number(item.quantity || 0)),
        }));

        setCatalog(mapped);
      } catch (error) {
        console.error('Failed to load picking catalog:', error);
        if (!cancelled) {
          setErrorMessage('Nem sikerült betölteni a termékeket az adatbázisból.');
        }
      } finally {
        if (!cancelled) {
          setIsCatalogLoading(false);
        }
      }
    };

    fetchCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchMaterialRequests = async () => {
      setIsRequestsLoading(true);
      try {
        const response = await api.get('/material-requests', { params: { line } });
        if (!cancelled) {
          setActiveRequests(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error('Failed to load material requests:', error);
        if (!cancelled) {
          setErrorMessage('Nem sikerült betölteni a folyamatban lévő igényléseket.');
        }
      } finally {
        if (!cancelled) {
          setIsRequestsLoading(false);
        }
      }
    };

    fetchMaterialRequests();

    return () => {
      cancelled = true;
    };
  }, [line]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      const categoryMatch = selectedCategory === 'Összes' || item.category === selectedCategory;
      const searchMatch =
        q.length === 0 ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q);
      return categoryMatch && searchMatch;
    });
  }, [catalog, search, selectedCategory]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => {
        const item = catalog.find((catalogItem) => catalogItem.id === Number(id));
        if (!item) {
          return null;
        }
        return { item, quantity };
      })
      .filter((value): value is { item: CatalogItem; quantity: number } => Boolean(value));
  }, [cart, catalog]);

  const setQuantity = (itemId: number, quantity: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[itemId];
        return next;
      }
      next[itemId] = quantity;
      return next;
    });
  };

  const handleSubmitRequest = async () => {
    if (cartItems.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await api.post('/material-requests', {
        line,
        priority,
        items: cartItems.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
      });

      const requestsResponse = await api.get('/material-requests', { params: { line } });
      setActiveRequests(Array.isArray(requestsResponse.data) ? requestsResponse.data : []);

      setCart({});
      setPriority('normal');
    } catch (error) {
      console.error('Failed to submit material request:', error);
      setErrorMessage('Az igénylés mentése nem sikerült. Próbáld újra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="xl">
      <Box
        sx={{
          mt: 4,
          mb: 4,
          '@keyframes pickingPulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(59,130,246,0.65)' },
            '70%': { boxShadow: '0 0 0 8px rgba(59,130,246,0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0)' },
          },
        }}
      >
        <Paper sx={{ mb: 2.5, p: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="medium" sx={{ minWidth: 210 }}>
              <InputLabel>Line</InputLabel>
              <Select
                label="Line"
                value={line}
                onChange={(event) => setLine(event.target.value)}
                sx={{ minHeight: 48 }}
              >
                <MenuItem value="SMT-01">Line: SMT-01</MenuItem>
                <MenuItem value="Assembly-B">Line: Assembly-B</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="h6" fontWeight={700}>
              Material Request Dashboard
            </Typography>
          </Stack>

        </Paper>

        {errorMessage && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', xl: '1.25fr 1fr 0.95fr' },
          }}
        >
          <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={700} mb={1.5}>
            Anyagkatalógus
          </Typography>

          <TextField
            fullWidth
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cikkszám, név vagy vonalkód keresése..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} color="#94a3b8" />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.5,
              '& .MuiOutlinedInput-root': {
                minHeight: 56,
              },
            }}
          />

          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
            {categories.map((category) => (
              <Chip
                key={category}
                label={category}
                onClick={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? 'filled' : 'outlined'}
                sx={{
                  minHeight: 40,
                  ...(selectedCategory === category
                    ? { bgcolor: 'primary.main', color: 'primary.contrastText' }
                    : {}),
                }}
              />
            ))}
          </Stack>

          <Stack spacing={1.25} sx={{ maxHeight: '62vh', overflowY: 'auto', pr: 0.5 }}>
            {isCatalogLoading && (
              <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={28} />
              </Box>
            )}

            {!isCatalogLoading && filteredCatalog.map((item) => {
              const quantity = cart[item.id] ?? 0;

              return (
                <Paper
                  key={item.id}
                  variant="outlined"
                  sx={{ p: 1.5, borderRadius: 2, borderColor: 'divider' }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Package size={18} color="#94a3b8" />
                        <Typography fontWeight={700}>{item.name}</Typography>
                      </Stack>
                      <Typography variant="body1" fontWeight={800} sx={{ letterSpacing: '0.04em' }}>
                        {item.code}
                      </Typography>
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        Raktáron: {item.stock} db
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <IconButton
                        onClick={() => setQuantity(item.id, Math.max(0, quantity - 1))}
                        sx={{
                          width: 44,
                          height: 44,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Minus size={18} color={theme.palette.text.primary} />
                      </IconButton>
                      <Typography sx={{ minWidth: 28, textAlign: 'center', fontWeight: 800, fontSize: 18 }}>
                        {quantity}
                      </Typography>
                      <IconButton
                        onClick={() => setQuantity(item.id, quantity + 1)}
                        sx={{
                          width: 44,
                          height: 44,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Plus size={18} color={theme.palette.text.primary} />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}

            {!isCatalogLoading && filteredCatalog.length === 0 && (
              <Typography color="text.secondary">Nincs találat a keresésre.</Typography>
            )}
          </Stack>
          </Paper>

          <Paper
            sx={{
              p: 2,
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              minHeight: { xl: '72vh' },
            }}
          >
          <Typography variant="h6" fontWeight={700} mb={1.5}>
            Aktuális Igénylés
          </Typography>

          <Stack spacing={1} sx={{ flex: 1, maxHeight: '48vh', overflowY: 'auto', pr: 0.5 }}>
            {cartItems.length === 0 && (
              <Typography color="text.secondary">Még nincs tétel az igénylésben.</Typography>
            )}

            {cartItems.map(({ item, quantity }) => {
              const isPartial = quantity > item.stock;
              return (
                <Paper
                  key={item.id}
                  variant="outlined"
                  sx={{ p: 1.25, borderRadius: 2, borderColor: 'divider' }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Box>
                      <Typography fontWeight={700}>{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.code}
                      </Typography>
                      <Typography variant="h6" fontWeight={800}>
                        {quantity} db
                      </Typography>
                      {isPartial && (
                        <Stack direction="row" spacing={0.5} alignItems="center" mt={0.4}>
                          <AlertTriangle size={16} color="#facc15" />
                          <Typography variant="body2" sx={{ color: '#facc15' }}>
                            Részleges teljesítés várható
                          </Typography>
                        </Stack>
                      )}
                    </Box>

                    <IconButton
                      onClick={() => setQuantity(item.id, 0)}
                      sx={{
                        width: 44,
                        height: 44,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'action.hover',
                      }}
                    >
                      <Trash2 size={18} color={theme.palette.error.main} />
                    </IconButton>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          <Divider sx={{ my: 1.5, borderColor: '#1e293b' }} />

          <Typography variant="subtitle1" fontWeight={700} mb={1}>
            Prioritás
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={priority}
            onChange={(_, value: Priority | null) => value && setPriority(value)}
            sx={{ mb: 1.5 }}
          >
            <ToggleButton
              value="normal"
              sx={{
                minHeight: 52,
                '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText' },
              }}
            >
              Normal
            </ToggleButton>
            <ToggleButton
              value="urgent"
              sx={{
                minHeight: 52,
                color: 'error.main',
                '&.Mui-selected': { bgcolor: 'error.main', color: 'error.contrastText' },
              }}
            >
              Urgent (Line Stop)
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            onClick={handleSubmitRequest}
            disabled={cartItems.length === 0 || isSubmitting}
            variant="contained"
            color="warning"
            sx={{
              mt: 'auto',
              minHeight: 60,
              fontSize: 20,
              fontWeight: 800,
              textTransform: 'none',
              position: 'sticky',
              bottom: 0,
            }}
          >
            {isSubmitting ? 'Leadás folyamatban...' : 'Igénylés Leadása'}
          </Button>
          </Paper>

          <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={700} mb={1.5}>
            Folyamatban lévő igénylések
          </Typography>

          <Stack spacing={1.25} sx={{ maxHeight: '66vh', overflowY: 'auto', pr: 0.5 }}>
            {isRequestsLoading && (
              <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={28} />
              </Box>
            )}

            {!isRequestsLoading && activeRequests.map((request) => {
              const meta = statusMeta[request.status];
              const createdAtLabel = new Date(request.createdAt).toLocaleTimeString('hu-HU', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <Paper
                  key={request.id}
                  variant="outlined"
                  sx={{ p: 1.5, borderRadius: 2, borderColor: 'divider' }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box>
                      <Typography fontWeight={800}>{request.id}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Line: {request.line} • {request.totalItems} tétel • {createdAtLabel}
                      </Typography>
                      <Stack direction="row" spacing={0.8} alignItems="center" mt={0.8}>
                        {request.status === 'delivered' ? (
                          <CheckCircle size={16} color={meta.color} />
                        ) : (
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: meta.color,
                              animation: request.status === 'picking' ? 'pickingPulse 1.4s infinite' : 'none',
                            }}
                          />
                        )}
                        <Typography variant="body2" sx={{ color: meta.color, fontWeight: 700 }}>
                          {meta.label}
                        </Typography>
                      </Stack>
                    </Box>

                    {request.priority === 'urgent' && (
                      <Chip label="P1" color="error" variant="outlined" />
                    )}
                  </Stack>
                </Paper>
              );
            })}

            {!isRequestsLoading && activeRequests.length === 0 && (
              <Typography color="text.secondary">Nincs aktív igénylés ezen a soron.</Typography>
            )}
          </Stack>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
}
