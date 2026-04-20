import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { faker } from '@faker-js/faker';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { Bug, QrCode, PackagePlus, AlertOctagon, Zap, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { api } from '../services/api';

// ─── Dark Palette ─────────────────────────────────────────────────────────────
const C = {
  root:     '#020617', // slate-950
  card:     '#0f172a', // slate-900
  inner:    '#1e293b', // slate-800
  border:   '#334155', // slate-700
  txt:      '#f1f5f9',
  muted:    '#94a3b8',
  code:     '#7dd3fc',
  accent:   '#3b82f6',
  red:      '#7f1d1d',
  redHover: '#991b1b',
  green:    '#166534',
  yellow:   '#854d0e',
  crit:     '#dc2626',
  warn:     '#d97706',
  ok:       '#22c55e',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface DbItem {
  id: number;
  name: string;
  barcode?: string;
  quantity: number;
  location?: string;
}

interface ScanCard {
  name: string;
  barcode: string;
  location: string;
  quantity: number;
  item_id?: number;
}

interface DeliveryRow {
  item_id: number;
  name: string;
  barcode: string;
  requested_quantity: number;
  picked_quantity: number;
  status: string;
}

interface SpawnedItem {
  item_id: number;
  item_name: string;
  barcode: string;
  requested_quantity: number;
}

interface SpawnedTask {
  id: number;
  name: string;
  priority: number;
  type: string;
  items: SpawnedItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function genBarcode(): string {
  return 'FAKER_' + faker.string.alphanumeric(12).toUpperCase();
}

function genFakeItem() {
  return {
    name: faker.commerce.productName(),
    barcode: genBarcode(),
    description: '[FAKER] ' + faker.commerce.productDescription().slice(0, 120),
    quantity: faker.number.int({ min: 20, max: 300 }),
  };
}

function priorityLabel(p: number): string {
  return ({ 1: 'P1 CRITICAL', 2: 'P2 HIGH', 3: 'P3 NORMAL', 4: 'P4 LOW' } as Record<number, string>)[p] ?? `P${p}`;
}

function priorityColor(p: number): string {
  return ({ 1: C.crit, 2: C.warn, 3: C.accent, 4: C.muted } as Record<number, string>)[p] ?? C.muted;
}

function apiErrMsg(e: unknown, fallback = 'Request failed'): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, pb: 1.5, borderBottom: `1px solid ${C.inner}` }}>
      <Box sx={{ color: C.accent, display: 'flex', flexShrink: 0 }}>{icon}</Box>
      <Box>
        <Typography sx={{ color: C.txt, fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ color: C.muted, fontSize: '0.7rem' }}>{subtitle}</Typography>
        )}
      </Box>
    </Box>
  );
}

function DarkCard({ children, sx = {} }: { children: ReactNode; sx?: object }) {
  return (
    <Box sx={{ bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2, p: 2.5, ...sx }}>
      {children}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DebugPage() {
  // Section 1 – Scannable Deck
  const [deckItems, setDeckItems]     = useState<ScanCard[]>([]);
  const [deckSource, setDeckSource]   = useState<'random' | 'db'>('random');
  const [autoRotate, setAutoRotate]   = useState(false);
  const [dbItems, setDbItems]         = useState<DbItem[]>([]);
  const rotateRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Section 2 – Inbound
  const [delivery, setDelivery]       = useState<DeliveryRow[]>([]);
  const [inboundId, setInboundId]     = useState<number | null>(null);
  const [inboundLoading, setInboundLoading] = useState(false);

  // Section 3 – Task Spawner
  const [spawnedTask, setSpawnedTask] = useState<SpawnedTask | null>(null);
  const [spawnLoading, setSpawnLoading] = useState<string | null>(null);

  // Section 4 – Event Triggers
  const [delayActive, setDelayActive]   = useState(false);
  const [delayLoading, setDelayLoading] = useState(false);
  const [blockEmail, setBlockEmail]     = useState('');
  const [blocked, setBlocked]           = useState<string[]>([]);
  const [damageLoading, setDamageLoading] = useState(false);
  const [blockLoading, setBlockLoading]   = useState(false);

  // Nuke dialog + snackbar
  const [nukeOpen, setNukeOpen]     = useState(false);
  const [nukeLoading, setNukeLoading] = useState(false);
  const [snack, setSnack]           = useState<{ open: boolean; msg: string; sev: 'success' | 'error' | 'info' }>({ open: false, msg: '', sev: 'success' });

  const toast = (msg: string, sev: 'success' | 'error' | 'info' = 'success') =>
    setSnack({ open: true, msg, sev });

  // Bootstrap
  useEffect(() => {
    api.get<DbItem[]>('/items').then(r => setDbItems(r.data)).catch(() => {});
    api.get('/simulator/status').then(r => {
      setDelayActive(r.data.delay?.enabled ?? false);
      setBlocked(r.data.blockedUsers ?? []);
    }).catch(() => {});
  }, []);

  // ── Deck generation ──────────────────────────────────────────────────────
  const generateDeck = useCallback(() => {
    const N = 3;
    if (deckSource === 'random') {
      setDeckItems(
        Array.from({ length: N }, () => {
          const fi = genFakeItem();
          return {
            name: fi.name,
            barcode: fi.barcode,
            location: `${faker.number.int({ min: 1, max: 5 })}-${String(faker.number.int({ min: 1, max: 10 })).padStart(2, '0')}-${faker.number.int({ min: 0, max: 3 })}`,
            quantity: fi.quantity,
          };
        })
      );
    } else {
      if (dbItems.length === 0) { toast('No items in database', 'info'); return; }
      const picked = [...dbItems].sort(() => Math.random() - 0.5).slice(0, Math.min(N, dbItems.length));
      setDeckItems(
        picked.map(i => ({
          name: i.name,
          barcode: i.barcode || genBarcode(),
          location: i.location ?? 'N/A',
          quantity: i.quantity,
          item_id: i.id,
        }))
      );
    }
  }, [deckSource, dbItems]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { generateDeck(); }, [deckSource, dbItems.length]);

  // Auto-rotate
  useEffect(() => {
    if (rotateRef.current) clearInterval(rotateRef.current);
    if (autoRotate) rotateRef.current = setInterval(generateDeck, 10_000);
    return () => { if (rotateRef.current) clearInterval(rotateRef.current); };
  }, [autoRotate, generateDeck]);

  // ── Section 2: Generate inbound delivery ─────────────────────────────────
  const handleGenerateDelivery = async () => {
    setInboundLoading(true);
    try {
      const count = faker.number.int({ min: 5, max: 10 });
      const fakes = Array.from({ length: count }, genFakeItem);
      const created: Array<{ id: number; name: string; barcode: string; req: number }> = [];

      for (const fi of fakes) {
        const r = await api.post<DbItem>('/items', {
          name: fi.name, barcode: fi.barcode, description: fi.description, quantity: fi.quantity,
        });
        created.push({
          id: r.data.id,
          name: fi.name,
          barcode: fi.barcode,
          req: faker.number.int({ min: 1, max: Math.max(1, Math.floor(fi.quantity / 4)) }),
        });
      }

      const taskName = `[FAKER] Inbound ${faker.date.recent().toISOString().slice(0, 10)} #${faker.string.alphanumeric(4).toUpperCase()}`;
      const spawnRes = await api.post('/simulator/spawn-task', {
        name: taskName,
        type: 'inbound',
        priority: 2,
        items: created.map(c => ({ item_id: c.id, requested_quantity: c.req })),
      });

      const taskId: number = spawnRes.data.task.id;
      setInboundId(taskId);
      setDelivery(created.map(c => ({ item_id: c.id, name: c.name, barcode: c.barcode, requested_quantity: c.req, picked_quantity: 0, status: 'pending' })));
      setDeckItems(
        created.slice(0, 3).map(c => ({ name: c.name, barcode: c.barcode, location: 'INBOUND', quantity: c.req, item_id: c.id }))
      );
      toast(`Inbound task #${taskId} created — ${created.length} items`);
    } catch (e) {
      toast(apiErrMsg(e, 'Failed to generate delivery'), 'error');
    } finally {
      setInboundLoading(false);
    }
  };

  const handleRefreshScan = async () => {
    if (!inboundId) return;
    try {
      const res = await api.get<SpawnedTask[]>('/tasks');
      const task = (res.data as unknown as Array<{ id: number; items: Array<{ item: { id: number }; picked_quantity: number; status: string }> }>)
        .find(t => t.id === inboundId);
      if (!task) { toast('Task not found — it may have been completed', 'info'); return; }
      setDelivery(prev => prev.map(row => {
        const ti = task.items?.find(i => i.item?.id === row.item_id);
        return ti ? { ...row, picked_quantity: ti.picked_quantity ?? 0, status: ti.status } : row;
      }));
      toast('Scan status refreshed');
    } catch (e) {
      toast(apiErrMsg(e, 'Refresh failed'), 'error');
    }
  };

  // ── Section 3: Spawn tasks ────────────────────────────────────────────────
  const spawnTask = async (variant: 'critical' | 'standard' | 'impossible') => {
    if (dbItems.length === 0 && variant !== 'impossible') {
      toast('No items in database — add some items first', 'error');
      return;
    }
    setSpawnLoading(variant);
    try {
      let taskItems: Array<{ item_id: number; requested_quantity: number }> = [];
      let taskName = '';
      let priority = 3;

      if (variant === 'critical') {
        const item = dbItems[Math.floor(Math.random() * dbItems.length)];
        priority = 1;
        taskName = `[FAKER] CRITICAL LINE-STOP #${faker.string.alphanumeric(4).toUpperCase()}`;
        taskItems = [{ item_id: item.id, requested_quantity: faker.number.int({ min: 1, max: 5 }) }];
      } else if (variant === 'standard') {
        const pool = [...dbItems].sort(() => Math.random() - 0.5).slice(0, faker.number.int({ min: 5, max: Math.min(10, dbItems.length) }));
        priority = 3;
        taskName = `[FAKER] Standard Task #${faker.string.alphanumeric(4).toUpperCase()}`;
        taskItems = pool.map(i => ({ item_id: i.id, requested_quantity: faker.number.int({ min: 1, max: 10 }) }));
      } else {
        const fi = genFakeItem();
        const itemRes = await api.post<DbItem>('/items', {
          name: fi.name, barcode: fi.barcode, description: fi.description, quantity: 10,
        });
        priority = 2;
        taskName = `[FAKER] SHORTAGE-TEST #${faker.string.alphanumeric(4).toUpperCase()}`;
        taskItems = [{ item_id: itemRes.data.id, requested_quantity: 50 }];
      }

      const res = await api.post('/simulator/spawn-task', { name: taskName, type: 'picking', priority, items: taskItems });
      const { task, items: rows } = res.data;
      const spawned: SpawnedTask = {
        id: task.id, name: task.name, priority: task.priority, type: task.type,
        items: rows.map((r: { item_id: number; item_name: string; barcode: string; requested_quantity: number }) => ({
          item_id: r.item_id, item_name: r.item_name, barcode: r.barcode, requested_quantity: r.requested_quantity,
        })),
      };
      setSpawnedTask(spawned);
      setDeckItems(
        spawned.items.slice(0, 3).map(ti => ({
          name: ti.item_name, barcode: ti.barcode || genBarcode(), location: 'PICKING', quantity: ti.requested_quantity,
        }))
      );
      toast(`Task #${task.id} spawned (${variant})`);
    } catch (e) {
      toast(apiErrMsg(e, 'Spawn failed'), 'error');
    } finally {
      setSpawnLoading(null);
    }
  };

  // ── Section 4: Event triggers ─────────────────────────────────────────────
  const handleDamageReport = async () => {
    setDamageLoading(true);
    try {
      const damage = faker.helpers.arrayElement(['Scratched surface', 'Broken packaging', 'Water damaged', 'Crushed', 'Missing components']);
      const res = await api.post('/damage-reports', {
        item_barcode: genBarcode(),
        item_name: faker.commerce.productName(),
        description: `[FAKER] Simulated damage: ${faker.lorem.sentence()} Damage type: ${damage}.`,
      });
      toast(`Damage report #${res.data.id} created — check supervisor screen`);
    } catch (e) {
      toast(apiErrMsg(e, 'Failed to create damage report'), 'error');
    } finally {
      setDamageLoading(false);
    }
  };

  const handleBlockUser = async (block: boolean) => {
    if (!blockEmail.trim()) { toast('Enter an email address', 'error'); return; }
    setBlockLoading(true);
    try {
      const res = await api.post('/simulator/block-user', { email: blockEmail.trim(), blocked: block });
      setBlocked(res.data.blockedUsers ?? []);
      toast(
        block
          ? `${blockEmail} blocked — mobile app will get 401 on next request`
          : `${blockEmail} unblocked`,
        block ? 'info' : 'success'
      );
    } catch (e) {
      toast(apiErrMsg(e, 'Operation failed'), 'error');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleToggleDelay = async () => {
    setDelayLoading(true);
    const next = !delayActive;
    try {
      await api.post('/simulator/delay', { enabled: next, ms: 5000 });
      setDelayActive(next);
      toast(next ? 'DB lock active — all API responses delayed 5s' : 'DB lock disabled', next ? 'info' : 'success');
    } catch (e) {
      toast(apiErrMsg(e, 'Failed to toggle delay'), 'error');
    } finally {
      setDelayLoading(false);
    }
  };

  // ── Nuke ─────────────────────────────────────────────────────────────────
  const handleNuke = async () => {
    setNukeLoading(true);
    try {
      const res = await api.post('/simulator/nuke');
      setDelivery([]); setInboundId(null); setSpawnedTask(null);
      generateDeck();
      const d = res.data.deleted;
      toast(`Nuked: ${d.tasks} tasks, ${d.items} items, ${d.damageReports} damage reports`);
    } catch (e) {
      toast(apiErrMsg(e, 'Nuke failed'), 'error');
    } finally {
      setNukeLoading(false);
      setNukeOpen(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ bgcolor: C.root, minHeight: '100%', p: 3 }}>

      {/* ── Top Bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Bug size={22} color={C.accent} />
          <Box>
            <Typography sx={{ color: C.txt, fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.02em' }}>
              Mobile Debug &amp; Simulator Dashboard
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: '0.7rem', fontFamily: '"Courier New", monospace' }}>
              DEPO WMS · Simulated test environment — not for production
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {delayActive && (
            <Chip
              label="⏳ DB LOCK ACTIVE"
              size="small"
              sx={{ bgcolor: '#78350f', color: '#fbbf24', fontFamily: '"Courier New", monospace', fontSize: '0.67rem', fontWeight: 700 }}
            />
          )}
          {blocked.length > 0 && (
            <Chip
              label={`🚫 ${blocked.length} USER${blocked.length > 1 ? 'S' : ''} BLOCKED`}
              size="small"
              sx={{ bgcolor: '#7f1d1d', color: '#fca5a5', fontFamily: '"Courier New", monospace', fontSize: '0.67rem', fontWeight: 700 }}
            />
          )}
          <Button
            startIcon={nukeLoading ? <CircularProgress size={13} color="inherit" /> : <Trash2 size={15} />}
            onClick={() => setNukeOpen(true)}
            disabled={nukeLoading}
            sx={{
              bgcolor: C.red, color: '#fca5a5', fontWeight: 700, fontSize: '0.76rem',
              letterSpacing: '0.08em', px: 2, py: 0.8, textTransform: 'uppercase',
              '&:hover': { bgcolor: C.redHover },
            }}
          >
            Nuke Test Data
          </Button>
        </Box>
      </Box>

      {/* ── Main Grid ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '2fr 1.4fr 1.4fr' }, gap: 2.5, alignItems: 'start' }}>

        {/* ════ Column 1: Scannable Deck ════ */}
        <DarkCard>
          <SectionHeader
            icon={<QrCode size={17} />}
            title="Scannable Test Deck"
            subtitle="Point your mobile device camera at these codes"
          />

          {/* Controls */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Select
              size="small"
              value={deckSource}
              onChange={e => setDeckSource(e.target.value as 'random' | 'db')}
              sx={{
                color: C.txt, fontSize: '0.78rem', bgcolor: C.inner, minWidth: 180,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
                '& .MuiSvgIcon-root': { color: C.muted },
              }}
            >
              <MenuItem value="random">Random Fake Items</MenuItem>
              <MenuItem value="db">From Database Items</MenuItem>
            </Select>

            <Button
              size="small"
              startIcon={<RefreshCw size={13} />}
              onClick={generateDeck}
              variant="outlined"
              sx={{ color: C.txt, borderColor: C.border, fontSize: '0.74rem', '&:hover': { borderColor: C.accent, color: C.accent } }}
            >
              Refresh
            </Button>

            <FormControlLabel
              control={
                <Switch
                  checked={autoRotate}
                  onChange={e => setAutoRotate(e.target.checked)}
                  size="small"
                />
              }
              label={<Typography sx={{ color: C.muted, fontSize: '0.74rem' }}>Auto-rotate 10s</Typography>}
              sx={{ ml: 0 }}
            />
          </Box>

          {/* Barcode Cards */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {deckItems.length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center' }}>
                <Typography sx={{ color: C.muted, fontSize: '0.85rem' }}>No codes yet — click Refresh.</Typography>
              </Box>
            ) : deckItems.map((item, i) => (
              <Box key={i} sx={{ bgcolor: '#ffffff', borderRadius: 1.5, p: 2, border: '3px solid #cbd5e1' }}>
                <Typography sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.82rem', mb: 0.25 }}>
                  {item.name}
                </Typography>
                <Typography sx={{ color: '#475569', fontSize: '0.68rem', fontFamily: '"Courier New", monospace', mb: 1.5 }}>
                  {item.barcode} &nbsp;·&nbsp; Loc: {item.location} &nbsp;·&nbsp; Qty: {item.quantity}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ color: '#64748b', fontSize: '0.62rem', mb: 0.5 }}>CODE 128</Typography>
                    <Barcode value={item.barcode} width={1.7} height={65} background="#ffffff" lineColor="#000000" fontSize={9} />
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ color: '#64748b', fontSize: '0.62rem', mb: 0.5 }}>QR CODE</Typography>
                    <QRCodeSVG value={item.barcode} size={120} bgColor="#ffffff" fgColor="#000000" />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </DarkCard>

        {/* ════ Column 2 ════ */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Inbound Simulator */}
          <DarkCard>
            <SectionHeader
              icon={<PackagePlus size={17} />}
              title="Inbound Injection"
              subtitle="Simulate incoming deliveries for the mobile /inbound screen"
            />

            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Button
                size="small"
                onClick={handleGenerateDelivery}
                disabled={inboundLoading}
                startIcon={inboundLoading ? <CircularProgress size={12} color="inherit" /> : <PackagePlus size={13} />}
                sx={{ bgcolor: '#1e3a5f', color: '#93c5fd', fontWeight: 600, fontSize: '0.74rem', textTransform: 'none', '&:hover': { bgcolor: '#1d4ed8' } }}
              >
                Generate Random Delivery
              </Button>
              {inboundId && (
                <Button
                  size="small"
                  onClick={handleRefreshScan}
                  startIcon={<RefreshCw size={13} />}
                  variant="outlined"
                  sx={{ color: C.muted, borderColor: C.border, fontSize: '0.74rem', textTransform: 'none', '&:hover': { borderColor: C.accent, color: C.accent } }}
                >
                  Refresh Scan Status
                </Button>
              )}
            </Box>

            {inboundId && (
              <Typography sx={{ color: C.muted, fontSize: '0.7rem', mb: 1.5 }}>
                Task{' '}
                <Box component="span" sx={{ fontFamily: '"Courier New", monospace', color: C.code }}>
                  #{inboundId}
                </Box>
                {' '}— scan these barcodes on the mobile Inbound screen
              </Typography>
            )}

            {delivery.length > 0 && (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ '& td, & th': { color: C.muted, fontSize: '0.7rem', borderColor: C.inner, py: 0.7, px: 0.75 } }}>
                  <TableHead>
                    <TableRow sx={{ '& th': { color: C.txt, fontWeight: 700, bgcolor: C.inner } }}>
                      <TableCell>Item</TableCell>
                      <TableCell>Barcode</TableCell>
                      <TableCell align="center">Req</TableCell>
                      <TableCell align="center">Got</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {delivery.map((row, i) => (
                      <TableRow key={i} sx={{ '&:hover': { bgcolor: C.inner } }}>
                        <TableCell sx={{ color: C.txt, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </TableCell>
                        <TableCell sx={{ fontFamily: '"Courier New", monospace', color: C.code, fontSize: '0.65rem' }}>
                          {row.barcode.replace('FAKER_', '')}
                        </TableCell>
                        <TableCell align="center">{row.requested_quantity}</TableCell>
                        <TableCell align="center">{row.picked_quantity}</TableCell>
                        <TableCell>
                          <Chip
                            label={row.status}
                            size="small"
                            sx={{
                              fontSize: '0.6rem', height: 17,
                              bgcolor: row.status === 'picked' ? C.green : row.status === 'shortage_accepted' ? C.yellow : C.inner,
                              color: row.status === 'picked' ? '#86efac' : row.status === 'shortage_accepted' ? '#fde68a' : C.muted,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </DarkCard>

          {/* Task Spawner */}
          <DarkCard>
            <SectionHeader
              icon={<Zap size={17} />}
              title="Task Spawner"
              subtitle="Generate picking tasks to test mobile sorting and priority logic"
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {/* Critical */}
              <Button
                fullWidth
                onClick={() => spawnTask('critical')}
                disabled={spawnLoading !== null}
                startIcon={spawnLoading === 'critical' ? <CircularProgress size={12} color="inherit" /> : <Zap size={13} />}
                sx={{ bgcolor: '#450a0a', color: '#fca5a5', fontWeight: 700, fontSize: '0.74rem', justifyContent: 'flex-start', textTransform: 'none', px: 2, py: 1, '&:hover': { bgcolor: '#7f1d1d' } }}
              >
                <Box sx={{ textAlign: 'left' }}>
                  <div>Spawn Critical Task (Priority 1)</div>
                  <Typography sx={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 400 }}>Line-stop scenario · 1 item · max urgency</Typography>
                </Box>
              </Button>

              {/* Standard */}
              <Button
                fullWidth
                onClick={() => spawnTask('standard')}
                disabled={spawnLoading !== null}
                startIcon={spawnLoading === 'standard' ? <CircularProgress size={12} color="inherit" /> : <Zap size={13} />}
                sx={{ bgcolor: '#1e3a5f', color: '#93c5fd', fontWeight: 700, fontSize: '0.74rem', justifyContent: 'flex-start', textTransform: 'none', px: 2, py: 1, '&:hover': { bgcolor: '#1d4ed8' } }}
              >
                <Box sx={{ textAlign: 'left' }}>
                  <div>Spawn Standard Task (Priority 3)</div>
                  <Typography sx={{ fontSize: '0.65rem', color: '#60a5fa', fontWeight: 400 }}>5–10 random real items · standard priority</Typography>
                </Box>
              </Button>

              {/* Impossible */}
              <Button
                fullWidth
                onClick={() => spawnTask('impossible')}
                disabled={spawnLoading !== null}
                startIcon={spawnLoading === 'impossible' ? <CircularProgress size={12} color="inherit" /> : <AlertOctagon size={13} />}
                sx={{ bgcolor: '#431407', color: '#fdba74', fontWeight: 700, fontSize: '0.74rem', justifyContent: 'flex-start', textTransform: 'none', px: 2, py: 1, '&:hover': { bgcolor: '#9a3412' } }}
              >
                <Box sx={{ textAlign: 'left' }}>
                  <div>Spawn Impossible Task (Shortage Test)</div>
                  <Typography sx={{ fontSize: '0.65rem', color: '#fb923c', fontWeight: 400 }}>Stock=10 · Request=50 · Tests partial-fulfillment warning</Typography>
                </Box>
              </Button>
            </Box>

            {/* Spawned task result */}
            {spawnedTask && (
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${C.inner}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
                  <Chip
                    label={`#${spawnedTask.id}`}
                    size="small"
                    sx={{ bgcolor: C.inner, color: C.code, fontFamily: '"Courier New", monospace', fontSize: '0.68rem' }}
                  />
                  <Chip
                    label={priorityLabel(spawnedTask.priority)}
                    size="small"
                    sx={{ bgcolor: priorityColor(spawnedTask.priority) + '22', color: priorityColor(spawnedTask.priority), fontSize: '0.65rem', fontWeight: 700 }}
                  />
                  <Typography sx={{ color: C.muted, fontSize: '0.7rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {spawnedTask.name}
                  </Typography>
                </Box>
                <Typography sx={{ color: C.muted, fontSize: '0.68rem', mb: 0.75 }}>Scan on mobile picking screen:</Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ '& td, & th': { color: C.muted, fontSize: '0.68rem', borderColor: C.inner, py: 0.6, px: 0.75 } }}>
                    <TableHead>
                      <TableRow sx={{ '& th': { color: C.txt, fontWeight: 700, bgcolor: C.inner } }}>
                        <TableCell>Item</TableCell>
                        <TableCell>Barcode</TableCell>
                        <TableCell align="center">Qty</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {spawnedTask.items.map((ti, i) => (
                        <TableRow key={i}>
                          <TableCell sx={{ color: C.txt, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ti.item_name}</TableCell>
                          <TableCell sx={{ fontFamily: '"Courier New", monospace', color: C.code, fontSize: '0.65rem' }}>{ti.barcode || '—'}</TableCell>
                          <TableCell align="center">{ti.requested_quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            )}
          </DarkCard>
        </Box>

        {/* ════ Column 3: Event Triggers ════ */}
        <DarkCard>
          <SectionHeader
            icon={<AlertOctagon size={17} />}
            title="Mobile Event Triggers"
            subtitle="Simulate rare and destructive mobile app states"
          />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Damaged Goods */}
            <Box>
              <Typography sx={{ color: C.txt, fontSize: '0.82rem', fontWeight: 700, mb: 0.5 }}>
                💥 Damaged Goods Report
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: '0.72rem', mb: 1.5 }}>
                Injects a mock damage report to test supervisor / admin resolution screens.
              </Typography>
              <Button
                fullWidth
                onClick={handleDamageReport}
                disabled={damageLoading}
                startIcon={damageLoading ? <CircularProgress size={12} color="inherit" /> : <AlertOctagon size={13} />}
                sx={{ bgcolor: '#4a1d96', color: '#c4b5fd', fontWeight: 600, fontSize: '0.76rem', textTransform: 'none', '&:hover': { bgcolor: '#6d28d9' } }}
              >
                Simulate Damaged Goods Report
              </Button>
            </Box>

            <Divider sx={{ borderColor: C.inner }} />

            {/* Auth Invalidation */}
            <Box>
              <Typography sx={{ color: C.txt, fontSize: '0.82rem', fontWeight: 700, mb: 0.5 }}>
                🔑 Invalidate Auth Tokens
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: '0.72rem', mb: 1.5 }}>
                Revokes a user's session. Mobile app receives{' '}
                <Box component="span" sx={{ fontFamily: '"Courier New", monospace', color: '#fca5a5' }}>401 Unauthorized</Box>
                {' '}and is redirected to login.
              </Typography>

              <TextField
                size="small"
                fullWidth
                placeholder="user@example.com"
                value={blockEmail}
                onChange={e => setBlockEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleBlockUser(true); }}
                sx={{
                  mb: 1,
                  '& .MuiInputBase-input': { color: C.txt, fontSize: '0.8rem', fontFamily: '"Courier New", monospace' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
                  '& .MuiInputBase-input::placeholder': { color: C.muted },
                  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: C.accent },
                }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small" fullWidth
                  onClick={() => handleBlockUser(true)}
                  disabled={blockLoading}
                  startIcon={blockLoading ? <CircularProgress size={11} color="inherit" /> : <WifiOff size={13} />}
                  sx={{ bgcolor: C.red, color: '#fca5a5', fontWeight: 600, fontSize: '0.72rem', textTransform: 'none', '&:hover': { bgcolor: C.redHover } }}
                >
                  Block (Force 401)
                </Button>
                <Button
                  size="small" fullWidth
                  onClick={() => handleBlockUser(false)}
                  disabled={blockLoading}
                  startIcon={<Wifi size={13} />}
                  sx={{ bgcolor: C.green, color: '#86efac', fontWeight: 600, fontSize: '0.72rem', textTransform: 'none', '&:hover': { bgcolor: '#15803d' } }}
                >
                  Unblock
                </Button>
              </Box>

              {blocked.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ color: C.muted, fontSize: '0.67rem', mb: 0.5 }}>Currently blocked:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {blocked.map(u => (
                      <Chip key={u} label={u} size="small" sx={{ bgcolor: '#7f1d1d', color: '#fca5a5', fontFamily: '"Courier New", monospace', fontSize: '0.63rem', height: 19 }} />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>

            <Divider sx={{ borderColor: C.inner }} />

            {/* DB Lock */}
            <Box>
              <Typography sx={{ color: C.txt, fontSize: '0.82rem', fontWeight: 700, mb: 0.5 }}>
                ⏳ Simulate Database Lock
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: '0.72rem', mb: 1.5 }}>
                Adds a 5-second delay to all API responses. Tests mobile loading spinners and timeout error handling.
              </Typography>
              <Button
                fullWidth
                onClick={handleToggleDelay}
                disabled={delayLoading}
                startIcon={delayLoading ? <CircularProgress size={12} color="inherit" /> : undefined}
                sx={{
                  bgcolor: delayActive ? '#78350f' : C.inner,
                  color: delayActive ? '#fbbf24' : C.muted,
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  border: `1px solid ${delayActive ? '#92400e' : C.border}`,
                  textTransform: 'none',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: delayActive ? '#92400e' : C.border },
                }}
              >
                {delayActive ? '⏳ DB Lock ACTIVE — Click to Disable' : '▶ Enable DB Lock (5s delay)'}
              </Button>

              {delayActive && (
                <Box sx={{ mt: 1, p: 1, bgcolor: '#1c1400', border: '1px solid #92400e', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{
                    width: 8, height: 8, borderRadius: '50%', bgcolor: '#fbbf24', flexShrink: 0,
                    animation: 'dbpulse 1.5s ease-in-out infinite',
                    '@keyframes dbpulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
                  }} />
                  <Typography sx={{ color: '#fbbf24', fontSize: '0.7rem', fontFamily: '"Courier New", monospace' }}>
                    All API responses delayed +5000ms
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </DarkCard>
      </Box>

      {/* ── Nuke Confirmation Dialog ── */}
      <Dialog
        open={nukeOpen}
        onClose={() => setNukeOpen(false)}
        PaperProps={{ sx: { bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2, minWidth: 420 } }}
      >
        <DialogTitle sx={{ color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
          <Trash2 size={18} />
          Nuke All Test Data?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: C.muted, fontSize: '0.85rem' }}>
            This will{' '}
            <Box component="span" sx={{ color: '#fca5a5', fontWeight: 700 }}>permanently delete</Box>
            {' '}all simulator-generated data tagged with{' '}
            <Box component="span" sx={{ fontFamily: '"Courier New", monospace', color: C.code }}>FAKER_</Box>
            {' '}or{' '}
            <Box component="span" sx={{ fontFamily: '"Courier New", monospace', color: C.code }}>[FAKER]</Box>:
          </DialogContentText>
          <Box component="ul" sx={{ color: C.muted, fontSize: '0.8rem', mt: 1.5, pl: 2.5, lineHeight: 2 }}>
            <li>All task_items belonging to <Box component="span" sx={{ fontFamily: '"Courier New", monospace', color: C.code }}>[FAKER]</Box> tasks</li>
            <li>All tasks named <Box component="span" sx={{ fontFamily: '"Courier New", monospace', color: C.code }}>[FAKER]…</Box></li>
            <li>All items with barcode <Box component="span" sx={{ fontFamily: '"Courier New", monospace', color: C.code }}>FAKER_…</Box></li>
            <li>All damage reports with <Box component="span" sx={{ fontFamily: '"Courier New", monospace', color: C.code }}>[FAKER]</Box> descriptions</li>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setNukeOpen(false)} sx={{ color: C.muted }}>Cancel</Button>
          <Button
            onClick={handleNuke}
            disabled={nukeLoading}
            startIcon={nukeLoading ? <CircularProgress size={13} color="inherit" /> : <Trash2 size={14} />}
            sx={{ bgcolor: C.red, color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase', px: 2.5, '&:hover': { bgcolor: C.redHover } }}
          >
            Nuke Everything
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          severity={snack.sev}
          sx={{ bgcolor: C.card, border: `1px solid ${C.border}`, color: C.txt }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
