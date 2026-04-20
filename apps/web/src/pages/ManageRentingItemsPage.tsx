import { useMemo, useState } from 'react';
import { Box, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import RentingItemsPage, { type RentingItemsMode, type RentingItemsPageProps } from './RentingItemsPage';
import { isApproverRole } from '../utils/roles';

type ManageView = 'request' | 'manage';

export default function ManageRentingItemsPage(props: RentingItemsPageProps) {
  const canSwitchViews = useMemo(() => isApproverRole(props.role), [props.role]);
  const [view, setView] = useState<ManageView>('manage');

  const forceMode: RentingItemsMode = view === 'request' ? 'request' : 'manage';

  return (
    <Box>
      {canSwitchViews && (
        <Paper sx={{ mx: 3, mt: 3, mb: 2, p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="h6">Nézet</Typography>
              <Typography variant="body2" color="text.secondary">
                Válts kölcsönzés és jóváhagyás között
              </Typography>
            </Box>

            <ToggleButtonGroup
              exclusive
              size="small"
              value={view}
              onChange={(_, next) => next && setView(next)}
            >
              <ToggleButton value="request">Kölcsönözni szeretnék</ToggleButton>
              <ToggleButton value="manage">Jóváhagyás</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Paper>
      )}

      <RentingItemsPage {...props} forceMode={forceMode} />
    </Box>
  );
}