import { Router } from 'express';
import multer from 'multer';
import { importarPartidas } from '../services/importadorIA.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // Limite de 20MB

router.post('/', upload.single('arquivo'), async (req, res): Promise<any> => {
  try {
    const { competicaoId } = req.body;
    if (!competicaoId) return res.status(400).json({ error: 'Falta o ID da competição.' });
    if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro enviado.' });

    const mimeType = req.file.mimetype;
    const conteudo = mimeType.includes('text') ? req.file.buffer.toString('utf-8') : req.file.buffer;

    const resultado = await importarPartidas({
      competicaoId: Number(competicaoId),
      conteudo,
      mimeType,
    });

    return res.json(resultado);
  } catch (error: any) {
    console.error('Erro na importação:', error);
    return res.status(500).json({ error: error.message || 'Erro interno na IA' });
  }
});

export default router;