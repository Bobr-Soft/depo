import { Box, Typography } from '@mui/material';

export default function DebugPage() {
  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Debug
      </Typography>
      <Typography variant="body1">
        Itt találhatók a hibakereséshez és diagnosztikához kapcsolódó funkciók.
      </Typography>
    </Box>
  );
}
