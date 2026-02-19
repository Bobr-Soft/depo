import { Box, Typography } from '@mui/material';

export default function RentingItemsPage() {
    return (
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          Kölcsönzés
        </Typography>
        <Typography variant="body1">
          Itt kezelheted a kölcsönzési folyamatot, megtekintheted a kölcsönzött eszközöket, és nyomon követheted a visszahozatalokat.
        </Typography>
        {/* Itt jöhet a kölcsönzési funkciók implementációja */}
      </Box>
    );
  }