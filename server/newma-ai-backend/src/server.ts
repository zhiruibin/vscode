import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { chatRouter } from './routes/chat.js';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3901;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));

app.get('/health', (_req, res) => {
	res.json({ status: 'ok', service: 'newma-ai-backend' });
});

app.use('/v1/chat', chatRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
	console.error('Unhandled error:', err);
	res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, "127.0.0.1", () => {
	console.log(`[newma-ai-backend] listening on http://127.0.0.1:${PORT}`);
});
