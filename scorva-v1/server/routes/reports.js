'use strict';

const express = require('express');
const ExcelJS = require('exceljs');
const { db }  = require('../../../packages/db/src/index');
const router  = express.Router();

const HDR_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2332' } };
const HDR_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = HDR_FONT;
  row.fill = HDR_FILL;
  row.commit();
}

async function sendWorkbook(wb, res, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// GET /api/reports/poam
router.get('/poam', async (req, res, next) => {
  try {
    const poams = await db.poam.findMany({
      where: req.applyTenantFilter({}),
      orderBy: { id: 'asc' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SCORVA';
    const ws = wb.addWorksheet('POA&M');

    ws.columns = [
      { header: 'ID',                   key: 'id',                  width: 12 },
      { header: 'Title',                key: 'title',               width: 40 },
      { header: 'Severity',             key: 'severity',            width: 12 },
      { header: 'Status',               key: 'status',              width: 14 },
      { header: 'Weakness',             key: 'weakness',            width: 40 },
      { header: 'Control ID',           key: 'controlId',           width: 12 },
      { header: 'Source Type',          key: 'sourceType',          width: 16 },
      { header: 'Source ID',            key: 'sourceId',            width: 16 },
      { header: 'Responsible Party',    key: 'responsibleParty',    width: 24 },
      { header: 'Point of Contact',     key: 'pointOfContact',      width: 24 },
      { header: 'Resources',            key: 'resources',           width: 20 },
      { header: 'Scheduled Completion', key: 'scheduledCompletion', width: 20 },
      { header: 'Identified Date',      key: 'identifiedDate',      width: 16 },
      { header: 'Completed Date',       key: 'completedDate',       width: 16 },
      { header: 'Closed Date',          key: 'closedDate',          width: 16 },
      { header: 'POAM Type',            key: 'poamType',            width: 16 },
      { header: 'Risk Decision',        key: 'riskDecision',        width: 16 },
      { header: 'Risk Rationale',       key: 'riskRationale',       width: 40 },
      { header: 'Comments',             key: 'comments',            width: 40 },
    ];
    styleHeader(ws);

    for (const p of poams) {
      ws.addRow({
        id:                  p.id,
        title:               p.title,
        severity:            p.severity            || '',
        status:              p.status,
        weakness:            p.weakness            || '',
        controlId:           p.controlId           || '',
        sourceType:          p.sourceType          || '',
        sourceId:            p.sourceId            || '',
        responsibleParty:    p.responsibleParty    || '',
        pointOfContact:      p.pointOfContact      || '',
        resources:           p.resources           || '',
        scheduledCompletion: p.scheduledCompletion || '',
        identifiedDate:      p.identifiedDate      || '',
        completedDate:       p.completedDate       || '',
        closedDate:          p.closedDate          || '',
        poamType:            p.poamType            || '',
        riskDecision:        p.riskDecision        || '',
        riskRationale:       p.riskRationale       || '',
        comments:            p.comments            || '',
      });
    }

    const date = new Date().toISOString().split('T')[0];
    await sendWorkbook(wb, res, `POAM_Report_${date}.xlsx`);
  } catch (err) { next(err); }
});

// GET /api/reports/controls
router.get('/controls', async (req, res, next) => {
  try {
    const controls = await db.control.findMany({
      where: req.applyTenantFilter({}),
      orderBy: { id: 'asc' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SCORVA';
    const ws = wb.addWorksheet('Controls');

    ws.columns = [
      { header: 'ID',               key: 'id',              width: 14 },
      { header: 'Title',            key: 'title',           width: 40 },
      { header: 'Family',           key: 'family',          width: 32 },
      { header: 'Status',           key: 'status',          width: 20 },
      { header: 'Baseline',         key: 'baseline',        width: 10 },
      { header: 'Last Review',      key: 'lastReview',      width: 14 },
      { header: 'Findings',         key: 'findings',        width: 10 },
      { header: 'ConMon Status',    key: 'conmonStatus',    width: 16 },
      { header: 'ConMon Group',     key: 'conmonGroup',     width: 20 },
      { header: 'ConMon Frequency', key: 'conmonFrequency', width: 18 },
      { header: 'Notes',            key: 'notes',           width: 40 },
    ];
    styleHeader(ws);

    for (const c of controls) {
      ws.addRow({
        id:              c.id,
        title:           c.title,
        family:          c.family          || '',
        status:          c.status,
        baseline:        c.baseline        || '',
        lastReview:      c.lastReview      || '',
        findings:        c.findings        || 0,
        conmonStatus:    c.conmonStatus    || '',
        conmonGroup:     c.conmonGroup     || '',
        conmonFrequency: c.conmonFrequency || '',
        notes:           c.notes          || '',
      });
    }

    const date = new Date().toISOString().split('T')[0];
    await sendWorkbook(wb, res, `Controls_Report_${date}.xlsx`);
  } catch (err) { next(err); }
});

module.exports = router;
