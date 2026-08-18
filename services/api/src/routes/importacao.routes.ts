import { Router } from 'express';
import multer from 'multer';
import { importarPartidas } from '../services/importadorIA.service';
import { prisma } from '../lib/prisma';

const router = Router();
const TIPOS_PERMITIDOS = new Set([
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (_req, file, callback) => callback(null, TIPOS_PERMITIDOS.has(file.mimetype)),
});

router.post('/', upload.single('arquivo'), async (req, res): Promise<any> => {
  try {
    const competicaoId = Number(req.body?.competicaoId);
    const clubeId = Number(req.headers['x-clube-id']);
    if (!Number.isSafeInteger(competicaoId) || competicaoId <= 0) {
      return res.status(400).json({ error: 'ID da competição inválido.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo válido enviado.' });

    const pertenceAoClube = await prisma.competicao.count({
      where: { id: competicaoId, clube_id: clubeId },
    });
    if (!pertenceAoClube) {
      return res.status(403).json({ error: 'Competição não pertence ao clube ativo.' });
    }

    const mimeType = req.file.mimetype;
    const conteudo = mimeType.includes('text') ? req.file.buffer.toString('utf-8') : req.file.buffer;

    const resultado = await importarPartidas({
      competicaoId,
      conteudo,
      mimeType,
    });

    return res.json(resultado);
  } catch (error: any) {
    console.error('Erro na importação:', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível importar o arquivo.' });
  }
});

export default router;
