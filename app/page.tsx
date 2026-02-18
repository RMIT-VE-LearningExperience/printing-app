import Link from "next/link";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";

export default function HomePage() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", py: 4 }}>
      <Container maxWidth="sm">
        <Paper elevation={2} sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h4" component="h1">
              Printing App
            </Typography>
            <Typography color="text.secondary">
              Go to the tutorial admin area to build printer tutorial content.
            </Typography>
            <Box>
              <Button component={Link} href="/admin" variant="contained">
                Open Tutorial Admin
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
