import { Router } from 'express';
export const legalRouter = Router();

// Simple JSON/Markdown text; frontend can render
legalRouter.get('/terms', (req, res) => {
  res.json({
    title: 'Terms of Service',
    updatedAt: '2025-08-01',
    content: 'These Terms of Service govern your use of QuestionBanks...'
  });
});

legalRouter.get('/privacy', (req, res) => {
  res.json({
    title: 'Privacy Policy',
    updatedAt: '2025-08-01',
    content: 'We collect and process personal data to operate the service...'
  });
});
